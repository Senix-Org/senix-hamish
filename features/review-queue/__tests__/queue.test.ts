import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves the queue primitives that guarantee a job is processed exactly
 * once even when the serverless analyze path and the standalone worker
 * race for the same analysis.
 * Failure means: a PR could be reviewed twice and post duplicate comments,
 * or double-charge LLM cost.
 */

const redisMock = {
  lpush: vi.fn(),
  lmove: vi.fn(),
  lrem: vi.fn(),
  llen: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => redisMock),
}));

import {
  enqueue,
  dequeue,
  ackJob,
  nackJob,
  claimAnalysis,
  releaseAnalysisClaim,
} from '@features/review-queue/queue';
import type { Job } from '@features/review-queue/queue';

beforeEach(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
  Object.values(redisMock).forEach((fn) => fn.mockReset());
});

const samplePayload = {
  analysisId: 'a-1',
  pullRequestId: 'pr-1',
  userId: 'user-1',
  installationId: 1,
  owner: 'o',
  repo: 'r',
  prNumber: 7,
  headSha: 'head',
  baseSha: 'base',
};

describe('claimAnalysis (exactly-once ownership)', () => {
  it('grants ownership to the first caller (SET NX returns OK)', async () => {
    redisMock.set.mockResolvedValue('OK');
    expect(await claimAnalysis('a-1')).toBe(true);
    expect(redisMock.set).toHaveBeenCalledWith(
      'jobs:claim:a-1',
      '1',
      expect.objectContaining({ nx: true })
    );
  });

  it('denies ownership to a second concurrent caller (SET NX returns null)', async () => {
    redisMock.set.mockResolvedValue(null);
    expect(await claimAnalysis('a-1')).toBe(false);
  });

  it('only one of two racing callers wins the claim', async () => {
    // First call sets the key, second sees it already exists.
    redisMock.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    const [first, second] = await Promise.all([claimAnalysis('a-1'), claimAnalysis('a-1')]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
  });

  it('releases a claim so a retry can re-acquire it', async () => {
    redisMock.del.mockResolvedValue(1);
    await releaseAnalysisClaim('a-1');
    expect(redisMock.del).toHaveBeenCalledWith('jobs:claim:a-1');
  });
});

describe('enqueue / dequeue / ack / nack', () => {
  it('enqueues a job and returns an id', async () => {
    redisMock.lpush.mockResolvedValue(1);
    const id = await enqueue('analyze-pr', samplePayload);
    expect(id).toContain('analyze-pr:');
    expect(redisMock.lpush).toHaveBeenCalledOnce();
  });

  it('dequeues and parses a job pushed to the queue', async () => {
    const job: Job = {
      id: 'analyze-pr:1',
      kind: 'analyze-pr',
      payload: samplePayload,
      attempts: 0,
      enqueuedAt: Date.now(),
    };
    redisMock.lmove.mockResolvedValue(JSON.stringify(job));
    const out = await dequeue();
    expect(out?.id).toBe('analyze-pr:1');
  });

  it('returns null when the queue is empty', async () => {
    redisMock.lmove.mockResolvedValue(null);
    expect(await dequeue()).toBeNull();
  });

  it('ack removes the job from the processing list (processed once)', async () => {
    const job: Job = {
      id: 'analyze-pr:1',
      kind: 'analyze-pr',
      payload: samplePayload,
      attempts: 0,
      enqueuedAt: 0,
    };
    redisMock.lrem.mockResolvedValue(1);
    await ackJob(job);
    expect(redisMock.lrem).toHaveBeenCalledWith('jobs:processing', 1, JSON.stringify(job));
  });

  it('nack retries below the attempt cap', async () => {
    const job: Job = {
      id: 'j',
      kind: 'analyze-pr',
      payload: samplePayload,
      attempts: 0,
      enqueuedAt: 0,
    };
    redisMock.lrem.mockResolvedValue(1);
    redisMock.lpush.mockResolvedValue(1);
    expect(await nackJob(job, 'transient')).toBe(true);
  });

  it('nack drops the job once the attempt cap is reached', async () => {
    const job: Job = {
      id: 'j',
      kind: 'analyze-pr',
      payload: samplePayload,
      attempts: 2,
      enqueuedAt: 0,
    };
    redisMock.lrem.mockResolvedValue(1);
    expect(await nackJob(job, 'still failing')).toBe(false);
  });
});
