/**
 * Minimal local declaration of the `cloudflare:workers` runtime module —
 * just the Workflows surface this codebase uses. The project deliberately
 * does not depend on @cloudflare/workers-types (its global types conflict
 * with Next's DOM lib types), and this virtual module only exists inside
 * the workerd runtime, so tsc/vitest need this shim to typecheck files that
 * import it. Kept intentionally tiny; extend only when new runtime APIs are
 * actually used.
 */
declare module 'cloudflare:workers' {
  export type WorkflowSleepDuration = string | number;

  export type WorkflowStepConfig = {
    retries?: {
      limit: number;
      delay: WorkflowSleepDuration;
      backoff?: 'constant' | 'linear' | 'exponential';
    };
    timeout?: WorkflowSleepDuration;
  };

  export type WorkflowEvent<T> = {
    payload: Readonly<T>;
    timestamp: Date;
    instanceId: string;
  };

  export abstract class WorkflowStep {
    do<T>(name: string, callback: () => Promise<T>): Promise<T>;
    do<T>(name: string, config: WorkflowStepConfig, callback: () => Promise<T>): Promise<T>;
    sleep(name: string, duration: WorkflowSleepDuration): Promise<void>;
  }

  export abstract class WorkflowEntrypoint<Env = unknown, T = unknown> {
    protected env: Env;
    protected ctx: { waitUntil(promise: Promise<unknown>): void };
    abstract run(event: WorkflowEvent<T>, step: WorkflowStep): Promise<unknown>;
  }
}
