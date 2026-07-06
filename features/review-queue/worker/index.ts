import 'dotenv/config';
import { dequeue, ackJob, nackJob, Job } from '@features/review-queue/queue';
import { processAnalyzePr } from './analyze-pr';
import { log } from './log';

const POLL_INTERVAL_MS = 2000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const HEARTBEAT_INTERVAL_MS = 60_000;
// Concurrency cap on simultaneous job processing (each job is one LLM call,
// which costs money and consumes provider rate limit). Tune against the
// DeepSeek rate limits; 5 is a conservative starting point.
const MAX_CONCURRENT_JOBS = 5;

const REQUIRED_ENV_VARS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_WEBHOOK_SECRET',
  'DEEPSEEK_API_KEY',
  'LLM_PROVIDER',
] as const;

let shuttingDown = false;
let activeJobs = 0;
let processedCount = 0;
let failedCount = 0;
let heartbeatTimer: NodeJS.Timeout | null = null;

/**
 * Verify every required env var is present at startup. Logs which one is
 * missing and exits with code 1 if any are absent — production logs surface
 * the misconfiguration immediately instead of failing on the first job.
 */
function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return value === undefined || value.trim() === '';
  });

  if (missing.length > 0) {
    for (const name of missing) {
      log.error('missing required env var', { var: name });
    }
    log.error('worker cannot start with missing env', { count: missing.length });
    process.exit(1);
  }

  log.info('env validated', { vars: REQUIRED_ENV_VARS.length });
}

async function processJob(job: Job): Promise<void> {
  const startedAt = Date.now();
  log.info('picked up job', { id: job.id, kind: job.kind, attempt: job.attempts + 1 });

  try {
    switch (job.kind) {
      case 'analyze-pr':
        await processAnalyzePr(job.payload);
        break;
      default: {
        const exhaustive: never = job.kind;
        throw new Error(`Unhandled job kind: ${exhaustive}`);
      }
    }
    await ackJob(job);
    processedCount++;
    log.info('job done', { id: job.id, durationMs: Date.now() - startedAt });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    const willRetry = await nackJob(job, message);
    failedCount++;
    log.error('job failed', {
      id: job.id,
      message,
      retry: willRetry ? 'will-retry' : 'dropped',
    });
  }
}

/**
 * Semaphore-wrapped processing: activeJobs counts jobs currently in flight
 * and the loop refuses to dequeue while at MAX_CONCURRENT_JOBS, so a burst
 * of queued jobs can never fan out into unbounded concurrent LLM calls.
 *
 * The capacity check happens BEFORE dequeue() on purpose (a deliberate
 * deviation from "dequeue then skip"): dequeue() atomically moves the job
 * into the processing list, so skipping after dequeue would strand the job
 * there instead of leaving it queued for the next poll.
 */
function processWithSemaphore(job: Job): void {
  activeJobs++;
  processJob(job).finally(() => {
    activeJobs--;
  });
}

async function loop(): Promise<void> {
  while (!shuttingDown) {
    if (activeJobs >= MAX_CONCURRENT_JOBS) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    const job = await dequeue();
    if (!job) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    processWithSemaphore(job);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Emit a periodic heartbeat with running totals so deployments without
 * structured metrics still surface "is the worker alive and healthy?" info
 * in plain logs. Counters are module-level and run for the lifetime of the
 * process; they reset on restart.
 */
function startHeartbeat(): void {
  heartbeatTimer = setInterval(() => {
    log.info('heartbeat', {
      processed: processedCount,
      failed: failedCount,
      activeJobs,
    });
  }, HEARTBEAT_INTERVAL_MS);
}

function setupShutdown(): void {
  const handler = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    log.info('shutting down', { signal, draining: activeJobs });
    const start = Date.now();
    while (activeJobs > 0 && Date.now() - start < SHUTDOWN_TIMEOUT_MS) {
      await sleep(200);
    }
    if (activeJobs > 0) {
      log.warn('forced exit', { activeJobs });
    } else {
      log.info('clean exit', { processed: processedCount, failed: failedCount });
    }
    process.exit(0);
  };
  process.on('SIGINT', () => handler('SIGINT'));
  process.on('SIGTERM', () => handler('SIGTERM'));
}

async function main(): Promise<void> {
  validateEnv();
  setupShutdown();
  startHeartbeat();
  log.info('starting', {
    pollIntervalMs: POLL_INTERVAL_MS,
    logFormat: process.env.WORKER_LOG_FORMAT ?? 'text',
    provider: process.env.LLM_PROVIDER,
  });
  await loop();
}

main().catch((err) => {
  log.error('fatal error', { message: err?.message ?? String(err) });
  process.exit(1);
});
