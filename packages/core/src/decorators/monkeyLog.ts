import { redisConnection } from "../config/redis";
import { WORKER_KEY } from "../constants";

export function MonkeyCapture(fn: Function) {
  return async (...args: any[]) => {
    const job = args[0];
    const workerId = args[1];
    const instance = args[2];
    const taskArgs = args.slice(3);

    const redis = redisConnection.getInstance(instance);
    const taskHistoryKey = `${WORKER_KEY}:${workerId}:task:${job.id}:logs`;

    const logEntry = (message: string, data?: any) => {
      redis.lpush(
        taskHistoryKey,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          message,
          functionArgs: data,
        })
      ).catch(() => {});
    };

    logEntry("parameters", taskArgs);

    const fnSource = fn.toString();
    const internalFunctions = fnSource.match(/function\s+(\w+)\s*\(/g);
    logEntry("internalFunctions", internalFunctions);

    const internalVariables = fnSource.match(/(var|const|let)\s+(\w+)\s*=/g);
    logEntry("internalVariables", internalVariables);

    const originalConsoleLog = console.log;
    const originalFetch = global.fetch;

    console.log = function (...logArgs: any[]) {
      logEntry(logArgs.join(" "), taskArgs);
      originalConsoleLog.apply(console, logArgs);
    };

    global.fetch = async (
      input: string | URL | globalThis.Request,
      init?: RequestInit
    ) => {
      logEntry("fetch", JSON.stringify([String(input), init]));
      return originalFetch(input, init);
    };

    try {
      const result = fn(...taskArgs);
      return result instanceof Promise ? await result : result;
    } finally {
      console.log = originalConsoleLog;
      global.fetch = originalFetch;
    }
  };
}
