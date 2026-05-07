type LogLevel = 'info' | 'warn' | 'error';

type LogFields = Record<string, string | number | boolean | null | undefined>;

function format(): 'json' | 'text' {
  return process.env.WORKER_LOG_FORMAT === 'json' ? 'json' : 'text';
}

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  if (format() === 'json') {
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(fields ?? {}),
    });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
    return;
  }

  const prefix = `[worker]${level === 'info' ? '' : ` [${level}]`}`;
  const tail = fields
    ? ' ' +
      Object.entries(fields)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
    : '';
  if (level === 'error') console.error(`${prefix} ${message}${tail}`);
  else if (level === 'warn') console.warn(`${prefix} ${message}${tail}`);
  else console.log(`${prefix} ${message}${tail}`);
}

/**
 * Tiny structured logger for the worker. Produces single-line JSON when
 * `WORKER_LOG_FORMAT=json` (greppable in Hetzner / Docker logs) and
 * human-readable `[worker]` lines otherwise. Used at the worker boot,
 * loop, heartbeat, and shutdown boundaries.
 */
export const log = {
  info: (message: string, fields?: LogFields): void => emit('info', message, fields),
  warn: (message: string, fields?: LogFields): void => emit('warn', message, fields),
  error: (message: string, fields?: LogFields): void => emit('error', message, fields),
};
