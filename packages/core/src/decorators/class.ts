import { QueueClassOptions, TaskOptions } from "../types/interfaces";
import { task } from "./task";
import { logger } from "../utils/logger";

/**
 * Class decorator that automatically queues all methods of a class
 */
export function QueueClass(options: QueueClassOptions = {}) {
  return function <T extends { new (...args: any[]): any }>(constructor: T) {
    logger.info("🏗️ QueueClass: Decorating class", {
      file: "class.ts",
      line: 24,
      function: "QueueClass",
      className: constructor.name,
    });

    // Get all method names from the prototype
    const methodNames = getAllMethodNames(
      constructor.prototype,
      options.includeInherited
    );

    // Filter methods based on include/exclude options
    const methodsToQueue = filterMethods(methodNames, options);

    // Create a new class extending the original
    const decoratedClass = class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        logger.debug("🏗️ QueueClass: Instantiating decorated class", {
          file: "class.ts",
          line: 39,
          function: "constructor",
          className: constructor.name,
        });

        // Get the group name from options or use class name
        const groupName = options.group || constructor.name;

        // Apply task decorator to each method
        methodsToQueue.forEach((methodName) => {
          const originalMethod = this[methodName];
          if (typeof originalMethod === "function" && !isConstructor(methodName)) {
            const methodOptions: TaskOptions = {
              ...options.defaultOptions,
              queue: options.queue,
              group: groupName, // Add group to task options
            };

            logger.debug("🔄 QueueClass: Configuring method with group", {
              file: "class.ts",
              line: 50,
              function: "constructor",
              className: constructor.name,
              methodName,
              groupName,
            });

            // Create a bound version of the original method
            const boundMethod = originalMethod.bind(this);

            // Create a property descriptor for the task decorator
            const descriptor: TypedPropertyDescriptor<any> = {
              configurable: true,
              enumerable: true,
              writable: true,
              value: boundMethod
            };

            // Apply the task decorator and ensure we get a PropertyDescriptor back
            const decoratedDescriptor = task(methodOptions)(
              this,
              methodName,
              descriptor
            ) as TypedPropertyDescriptor<any>;

            if (!decoratedDescriptor) {
              logger.error("❌ QueueClass: Failed to decorate method", {
                file: "class.ts",
                line: 89,
                function: "constructor",
                methodName,
              });
              return;
            }

            // Store both the original and decorated methods
            Object.defineProperty(this, methodName, {
              configurable: true,
              enumerable: true,
              value: decoratedDescriptor.value,
              writable: true
            });

            // Also store the original method for direct access if needed
            Object.defineProperty(this, `_original_${methodName}`, {
              value: boundMethod,
              writable: false,
              enumerable: false
            });

            logger.debug("🔄 QueueClass: Method decorated", {
              file: "class.ts",
              line: 60,
              function: "constructor",
              className: constructor.name,
              methodName,
              groupName,
            });
          }
        });
      }
    };

    // Copy static properties
    Object.defineProperty(decoratedClass, "name", {
      value: constructor.name,
      writable: false,
    });

    return decoratedClass;
  };
}

/**
 * Get all method names from a prototype
 */
function getAllMethodNames(
  prototype: any,
  includeInherited: boolean = false
): string[] {
  const methods = new Set<string>();

  // Get own methods
  Object.getOwnPropertyNames(prototype).forEach((name) => {
    if (typeof prototype[name] === "function") {
      methods.add(name);
    }
  });

  // Get inherited methods if requested
  if (includeInherited) {
    let currentProto = Object.getPrototypeOf(prototype);
    while (currentProto && currentProto !== Object.prototype) {
      Object.getOwnPropertyNames(currentProto).forEach((name) => {
        if (typeof currentProto[name] === "function") {
          methods.add(name);
        }
      });
      currentProto = Object.getPrototypeOf(currentProto);
    }
  }

  return Array.from(methods);
}

/**
 * Filter methods based on include/exclude options
 */
function filterMethods(
  methods: string[],
  options: QueueClassOptions
): string[] {
  let filteredMethods = methods.filter((name) => !isConstructor(name));

  if (options.include) {
    filteredMethods = filteredMethods.filter((name) =>
      options.include!.includes(name)
    );
  }

  if (options.exclude) {
    filteredMethods = filteredMethods.filter(
      (name) => !options.exclude!.includes(name)
    );
  }

  return filteredMethods;
}

/**
 * Check if a method name is a constructor
 */
function isConstructor(methodName: string): boolean {
  return methodName === "constructor";
}
