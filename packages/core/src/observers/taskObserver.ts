import { Redis } from "ioredis";
import { ObserverEvent, TaskStatus } from "../types/enums";
import { logger } from "../utils/logger";

export interface TaskObserverCallback {
  (taskId: string, status: TaskStatus, data?: any): void;
}

export class TaskObserver {
  private redis: Redis;
  private subscriberClient: Redis;
  private channelPrefix: string = "taskObserver:";
  private callbacks: Map<string, TaskObserverCallback[]> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
    // Create a separate connection for subscriptions with proper authentication
    this.subscriberClient = this.createSubscriberClient(redis);
    this.setupSubscriber();
  }

  private createSubscriberClient(redis: Redis): Redis {
    try {
      // Create a duplicate with the same configuration to ensure authentication is preserved
      const subscriberClient = redis.duplicate();
      
      // Add error handling for the subscriber client
      subscriberClient.on('error', (error) => {
        if (error.message && error.message.includes('NOAUTH')) {
          logger.error("🔐 TaskObserver: Redis authentication required for subscriber", {
            file: "taskObserver.ts",
            function: "createSubscriberClient",
            error: 'NOAUTH Authentication required',
            hint: 'Make sure Redis password is configured correctly'
          });
        } else if (error.message && error.message.includes('WRONGPASS')) {
          logger.error("🔐 TaskObserver: Redis authentication failed for subscriber", {
            file: "taskObserver.ts",
            function: "createSubscriberClient",
            error: 'WRONGPASS Invalid password',
            hint: 'Check your Redis password configuration'
          });
        } else {
          logger.error("❌ TaskObserver: Subscriber Redis connection error", {
            file: "taskObserver.ts",
            function: "createSubscriberClient",
            error,
          });
        }
      });

      subscriberClient.on('connect', () => {
        logger.debug("🔌 TaskObserver: Subscriber client connected", {
          file: "taskObserver.ts",
          function: "createSubscriberClient",
        });
      });

      subscriberClient.on('ready', () => {
        logger.debug("✅ TaskObserver: Subscriber client ready", {
          file: "taskObserver.ts",
          function: "createSubscriberClient",
        });
      });

      return subscriberClient;
    } catch (error) {
      logger.error("❌ TaskObserver: Failed to create subscriber client", {
        file: "taskObserver.ts",
        function: "createSubscriberClient",
        error,
      });
      throw error;
    }
  }

  private setupSubscriber(): void {
    try {
      this.subscriberClient.on("message", (channel: string, message: string) => {
        try {
          const eventName = this.getEventFromChannel(channel);
          const callbacks = this.callbacks.get(eventName);
          if (callbacks) {
            const { taskId, status, data } = JSON.parse(message);
            callbacks.forEach((callback) => callback(taskId, status, data));
          }
        } catch (error) {
          logger.error("❌ TaskObserver: Error processing message", {
            file: "taskObserver.ts",
            function: "setupSubscriber",
            channel,
            message,
            error,
          });
        }
      });

      logger.debug("👂 TaskObserver: Subscriber setup completed", {
        file: "taskObserver.ts",
        function: "setupSubscriber",
      });
    } catch (error) {
      logger.error("❌ TaskObserver: Failed to setup subscriber", {
        file: "taskObserver.ts",
        function: "setupSubscriber",
        error,
      });
      throw error;
    }
  }

  subscribe(event: ObserverEvent, callback: TaskObserverCallback): void {
    const channel = this.getChannelName(event);

    // Store callback
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);

    // Subscribe using the dedicated subscriber client
    this.subscriberClient
      .subscribe(channel)
      .then(() => {
        logger.debug("👀 TaskObserver: Subscribed to channel", {
          file: "taskObserver.ts",
          function: "subscribe",
          event,
          channel,
        });
      })
      .catch((err) => {
        // Enhanced error handling for authentication issues
        if (err.message && err.message.includes('NOAUTH')) {
          logger.error("🔐 TaskObserver: Authentication required for subscription", {
            file: "taskObserver.ts",
            function: "subscribe",
            event,
            channel,
            error: 'NOAUTH Authentication required',
            hint: 'Make sure Redis password is configured correctly'
          });
        } else if (err.message && err.message.includes('WRONGPASS')) {
          logger.error("🔐 TaskObserver: Authentication failed for subscription", {
            file: "taskObserver.ts",
            function: "subscribe",
            event,
            channel,
            error: 'WRONGPASS Invalid password',
            hint: 'Check your Redis password configuration'
          });
        } else {
          logger.error("❌ TaskObserver: Failed to subscribe", {
            file: "taskObserver.ts",
            function: "subscribe",
            event,
            channel,
            error: err,
          });
        }
        throw err;
      });
  }

  unsubscribe(event: ObserverEvent): void {
    const channel = this.getChannelName(event);
    this.subscriberClient.unsubscribe(channel)
      .then(() => {
        this.callbacks.delete(event);
        logger.debug("👋 TaskObserver: Unsubscribed from channel", {
          file: "taskObserver.ts",
          function: "unsubscribe",
          event,
          channel,
        });
      })
      .catch((err) => {
        logger.error("❌ TaskObserver: Failed to unsubscribe", {
          file: "taskObserver.ts",
          function: "unsubscribe",
          event,
          channel,
          error: err,
        });
      });
  }

  notify(
    event: ObserverEvent,
    taskId: string,
    status: TaskStatus,
    data?: any
  ): void {
    const channel = this.getChannelName(event);
    const message = JSON.stringify({ taskId, status, data });

    // Use the main Redis client for publishing
    this.redis.publish(channel, message)
      .then((count) => {
        logger.debug("📢 TaskObserver: Message published", {
          file: "taskObserver.ts",
          function: "notify",
          event,
          channel,
          subscribers: count,
        });
      })
      .catch((err) => {
        // Enhanced error handling for authentication issues
        if (err.message && err.message.includes('NOAUTH')) {
          logger.error("🔐 TaskObserver: Authentication required for publishing", {
            file: "taskObserver.ts",
            function: "notify",
            event,
            channel,
            error: 'NOAUTH Authentication required',
            hint: 'Make sure Redis password is configured correctly'
          });
        } else if (err.message && err.message.includes('WRONGPASS')) {
          logger.error("🔐 TaskObserver: Authentication failed for publishing", {
            file: "taskObserver.ts",
            function: "notify",
            event,
            channel,
            error: 'WRONGPASS Invalid password',
            hint: 'Check your Redis password configuration'
          });
        } else {
          logger.error("❌ TaskObserver: Failed to publish message", {
            file: "taskObserver.ts",
            function: "notify",
            event,
            channel,
            error: err,
          });
        }
      });
  }

  private getChannelName(event: ObserverEvent): string {
    return `${this.channelPrefix}${event}`;
  }

  private getEventFromChannel(channel: string): string {
    return channel.replace(this.channelPrefix, "");
  }

  async close(): Promise<void> {
    try {
      await this.subscriberClient.quit();
      logger.debug("👋 TaskObserver: Subscriber client closed", {
        file: "taskObserver.ts",
        function: "close",
      });
    } catch (error) {
      logger.error("❌ TaskObserver: Error closing subscriber client", {
        file: "taskObserver.ts",
        function: "close",
        error,
      });
    }
  }
}
