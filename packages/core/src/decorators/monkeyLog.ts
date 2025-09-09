import { redisConnection } from "../config/redis";
import { WORKER_KEY } from "../constants";

export function MonkeyCapture(fn: Function) {
  return async (...args: any[]) => {
    const promise = fn(...args);

    const originalConsoleLog = console.log;
    const originalFetch = global.fetch;

    // job is a arg and workerId also
    const job = args[0];
    const workerId = args[1];
    const instance = args[2];

    const redis = redisConnection.getInstance(instance);

    const taskHistoryKey = `${WORKER_KEY}:${workerId}:task:${job.id}:logs`;

    // grep all the internal functions inside the wrapped function
    const internalFunctions = fn.toString().match(/function\s+(\w+)\s*\(/g);

    redis.lpush(
      taskHistoryKey,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        message: "internalFunctions",
        functionArgs: internalFunctions,
      })
    );

    // we need to get all the internal variables inside the wrapped function
    const internalVariables = fn
      .toString()
      .match(/(var|const|let)\s+(\w+)\s*=/g);

    redis.lpush(
      taskHistoryKey,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        message: "internalVariables",
        functionArgs: internalVariables,
      })
    );

    console.log = function (...logArgs: any[]) {
      redis.lpush(
        taskHistoryKey,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          message: logArgs.join(" "),
          functionArgs: args, // Log the parameters passed to the function
        })
      );
      originalConsoleLog.apply(console, logArgs);
    };

    // logs fetch as well
    global.fetch = async (
      input: string | URL | globalThis.Request,
      init?: RequestInit
    ) => {
      redis.lpush(
        taskHistoryKey,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          message: "fetch",
          functionArgs: JSON.stringify([input, init]),
        })
      );
      return originalFetch(input, init);
    };

    let result;
    try {
      if (promise instanceof Promise) {
        result = await promise;
      } else {
        result = promise;
      }
    } finally {
      console.log = originalConsoleLog; // Restore original console.log
    }
    return result;
  };
}
