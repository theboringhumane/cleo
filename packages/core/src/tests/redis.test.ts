import {
  RedisConnectionType,
  RedisInstance,
  RedisConnection,
} from "../config/redis";
import Redis from "ioredis";

jest.mock("ioredis");

describe("RedisConnection", () => {
  let redisConnection: RedisConnectionType;

  beforeEach(() => {
    redisConnection = new RedisConnection();
  });

  describe("initializeInstance", () => {
    const mockConfig = {
      REDIS_HOST: "localhost",
      REDIS_PORT: "6379",
      INSTANCE_ID: "test",
    };

    it("should initialize a new Redis connection with the given instance ID", () => {
      const connection = redisConnection.initializeInstance(
        RedisInstance.QUEUE,
        mockConfig
      );

      expect(Redis).toHaveBeenCalledWith({
        host: "localhost",
        port: 6379,
        password: undefined,
        tls: undefined,
        db: 0,
      });
      expect(connection).toBeDefined();
    });

    it("should store the connection in the connections map", () => {
      redisConnection.initializeInstance(RedisInstance.QUEUE, mockConfig);
      const connection = redisConnection.getInstance(RedisInstance.QUEUE);

      expect(connection).toBeDefined();
    });
  });

  describe("getInstance", () => {
    it("should return the default connection if no instance ID is provided", () => {
      const mockConfig = {
        REDIS_HOST: "localhost",
        REDIS_PORT: "6379",
        INSTANCE_ID: "default",
      };

      redisConnection.initializeInstance(RedisInstance.DEFAULT, mockConfig);
      const connection = redisConnection.getInstance();

      expect(connection).toBeDefined();
    });

    it("should throw an error if the requested instance does not exist", () => {
      expect(() => {
        redisConnection.getInstance("nonexistent");
      }).toThrow("Redis connection not initialized for instance: nonexistent");
    });
  });
});
