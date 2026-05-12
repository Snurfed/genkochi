/**
 * Production-safe logger
 * Only logs in development mode (__DEV__)
 * In production, logs are suppressed to avoid performance issues and data leaks
 */

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

interface Logger {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

const createLogger = (): Logger => {
  const shouldLog = __DEV__;

  const createLogFn = (level: LogLevel) => (...args: any[]) => {
    if (shouldLog) {
      console[level](...args);
    }
  };

  return {
    log: createLogFn('log'),
    warn: createLogFn('warn'),
    error: createLogFn('error'),
    info: createLogFn('info'),
    debug: createLogFn('debug'),
  };
};

export const logger = createLogger();

// Convenience exports for common patterns
export const devLog = (...args: any[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export const devWarn = (...args: any[]) => {
  if (__DEV__) {
    console.warn(...args);
  }
};

export const devError = (...args: any[]) => {
  if (__DEV__) {
    console.error(...args);
  }
};

export default logger;
