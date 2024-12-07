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
    // Create a separate connection for subscriptions
    this.subscriberClient = redis.duplicate();
    this.setupSubscriber();
  }

  private setupSubscriber(): void {
    this.subscriberClient.on("message", (channel: string, message: string) => {
      const eventName = this.getEventFromChannel(channel);
      const callbacks = this.callbacks.get(eventName);
      if (callbacks) {
        const { taskId, status, data } = JSON.parse(message);
        callbacks.forEach((callback) => callback(taskId, status, data));
      }
    });
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
          line: 37,
          function: "subscribe",
          event,
          channel,
        });
      })
      .catch((err) => {
        logger.error("❌ TaskObserver: Failed to subscribe", {
          file: "taskObserver.ts",
          line: 38,
          function: "subscribe",
          event,
          error: err,
        });
        throw err;
      });
  }

  unsubscribe(event: ObserverEvent): void {
    const channel = this.getChannelName(event);
    this.subscriberClient.unsubscribe(channel).then(() => {
      this.callbacks.delete(event);
      logger.debug("👋 TaskObserver: Unsubscribed from channel", {
        file: "taskObserver.ts",
        line: 37,
        function: "unsubscribe",
        event,
        channel,
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
    this.redis.publish(channel, message).then((count) => {
      logger.debug("📢 TaskObserver: Message published", {
        file: "taskObserver.ts",
        line: 46,
        function: "notify",
        event,
        channel,
        subscribers: count,
      });
    });
  }

  private getChannelName(event: ObserverEvent): string {
    return `${this.channelPrefix}${event}`;
  }

  private getEventFromChannel(channel: string): string {
    return channel.replace(this.channelPrefix, "");
  }

  async close(): Promise<void> {
    await this.subscriberClient.quit();
  }
}
