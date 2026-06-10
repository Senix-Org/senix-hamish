import { Redis } from '@upstash/redis';
   
   /**
    * Job type registry. Add new job kinds here and TypeScript will force you
    * to handle them in every consumer.
    */
   export type JobPayloadMap = {
     'analyze-pr': {
       analysisId: string;       // primary key of the row in `analyses`
       pullRequestId: string;    // primary key of the row in `pull_requests`
       userId: string;           // app user who owns the installation (token budget)
       installationId: number;
       owner: string;
       repo: string;
       prNumber: number;
       headSha: string;
       baseSha: string;
     };
   };
   
   export type JobKind = keyof JobPayloadMap;
   
   export interface Job<K extends JobKind = JobKind> {
     id: string;
     kind: K;
     payload: JobPayloadMap[K];
     attempts: number;
     enqueuedAt: number;
   }
   
   const QUEUE_KEY = 'jobs:queue';
   const PROCESSING_KEY = 'jobs:processing';
   const CLAIM_KEY_PREFIX = 'jobs:claim:';
   const CLAIM_TTL_SECONDS = 3600;
   const MAX_ATTEMPTS = 3;
   
   let redisInstance: Redis | null = null;
   
   function redis(): Redis {
     if (!redisInstance) {
       const url = process.env.UPSTASH_REDIS_REST_URL;
       const token = process.env.UPSTASH_REDIS_REST_TOKEN;
       if (!url || !token) {
         throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set');
       }
       redisInstance = new Redis({ url, token });
     }
     return redisInstance;
   }
   
   /**
    * Push a job onto the queue. Returns the job id.
    */
   export async function enqueue<K extends JobKind>(
     kind: K,
     payload: JobPayloadMap[K]
   ): Promise<string> {
     const id = `${kind}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
     const job: Job<K> = {
       id,
       kind,
       payload,
       attempts: 0,
       enqueuedAt: Date.now(),
     };
     await redis().lpush(QUEUE_KEY, JSON.stringify(job));
     return id;
   }
   
   /**
    * Pull the next job from the queue and move it into the processing list.
    * Returns null if the queue is empty.
    *
    * NOTE: We use lmove (RIGHT→LEFT) for atomic move — equivalent to the
    * deprecated rpoplpush. If the worker crashes mid-job, the job stays in
    * the processing list for inspection / requeue.
    */
   /**
 * Pull the next job from the queue and move it into the processing list.
 * Returns null if the queue is empty.
 */
    export async function dequeue(): Promise<Job | null> {
        const raw = await redis().lmove(QUEUE_KEY, PROCESSING_KEY, 'right', 'left');
        if (raw === null || raw === undefined) return null;

  // Upstash auto-deserializes JSON values, so `raw` may already be an object.
        const job: Job =
        typeof raw === 'string' ? (JSON.parse(raw) as Job) : (raw as Job);

        return job;
    }
   
   /**
    * Exactly-once ownership claim.
    *
    * An analysis can be triggered down two paths: the fire-and-forget
    * serverless `analyze-pr` function AND the standalone Redis worker. Both
    * must call `claimAnalysis(analysisId)` before doing any work. The claim
    * is a Redis SET NX (set-if-not-exists) keyed by analysis id, so only the
    * first caller wins and the second backs off. This guarantees a given
    * analysis is processed once even when both paths race.
    *
    * Returns true if the caller now owns the analysis, false if someone
    * else already claimed it.
    */
   export async function claimAnalysis(analysisId: string): Promise<boolean> {
     const result = await redis().set(`${CLAIM_KEY_PREFIX}${analysisId}`, '1', {
       nx: true,
       ex: CLAIM_TTL_SECONDS,
     });
     // Upstash returns 'OK' when the key was set, null when it already existed.
     return result === 'OK';
   }

   /**
    * Release an ownership claim. Called when processing fails in a way that
    * should allow a retry by another worker.
    */
   export async function releaseAnalysisClaim(analysisId: string): Promise<void> {
     await redis().del(`${CLAIM_KEY_PREFIX}${analysisId}`);
   }

   /**
    * Mark a job as completed. Removes it from the processing list.
    */
   export async function ackJob(job: Job): Promise<void> {
     await redis().lrem(PROCESSING_KEY, 1, JSON.stringify(job));
   }
   
   /**
    * Mark a job as failed. Increments attempts and either re-queues or drops.
    * Returns true if the job will be retried, false if it was dropped.
    */
   export async function nackJob(job: Job, error: string): Promise<boolean> {
     // Remove the original entry from processing
     await redis().lrem(PROCESSING_KEY, 1, JSON.stringify(job));
   
     const nextAttempts = job.attempts + 1;
     if (nextAttempts >= MAX_ATTEMPTS) {
       console.error(`[queue] dropping job ${job.id} after ${nextAttempts} attempts: ${error}`);
       return false;
     }
   
     const retried: Job = { ...job, attempts: nextAttempts };
     await redis().lpush(QUEUE_KEY, JSON.stringify(retried));
     return true;
   }
   
   /**
    * Operational helpers — used by the internal status page.
    */
   export async function queueStats() {
     const [queued, processing] = await Promise.all([
       redis().llen(QUEUE_KEY),
       redis().llen(PROCESSING_KEY),
     ]);
     return { queued, processing };
   }