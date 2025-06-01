import { Redis } from 'ioredis';
import { logger } from './logger';

export class GroupLock {
  constructor(private redis: Redis) {}

  async acquireLock(groupName: string, holder: string, ttlMs: number = 5000): Promise<boolean> {
    try {
      const lockKey = `group:${groupName}:lock`;
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      
      const result = await this.redis.set(lockKey, holder, 'EX', ttlSeconds, 'NX');
      const acquired = result === 'OK';
      
      logger.debug("🔒 GroupLock: Lock acquisition attempt", {
        file: "groupLock.ts",
        function: "acquireLock",
        lockKey,
        holder,
        ttlMs,
        acquired,
      });
      
      return acquired;
    } catch (error) {
      logger.error("❌ GroupLock: Error acquiring lock", {
        file: "groupLock.ts",
        function: "acquireLock",
        groupName,
        holder,
        error,
      });
      return false;
    }
  }

  async releaseLock(groupName: string, holder: string): Promise<void> {
    try {
      const lockKey = `group:${groupName}:lock`;
      
      // Lua script to ensure only the lock holder can release the lock
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.redis.eval(script, 1, lockKey, holder) as number;
      
      if (result === 1) {
        logger.debug("🔓 GroupLock: Lock released successfully", {
          file: "groupLock.ts",
          function: "releaseLock",
          lockKey,
          holder,
        });
      } else {
        logger.warn("⚠️ GroupLock: Lock not released - not owned by holder", {
          file: "groupLock.ts",
          function: "releaseLock",
          lockKey,
          holder,
          note: "Lock might have expired or be owned by another process",
        });
      }
    } catch (error) {
      logger.error("❌ GroupLock: Error releasing lock", {
        file: "groupLock.ts",
        function: "releaseLock",
        groupName,
        holder,
        error,
      });
      throw error;
    }
  }

  async isLocked(groupName: string): Promise<boolean> {
    try {
      const lockKey = `group:${groupName}:lock`;
      const value = await this.redis.get(lockKey);
      return value !== null;
    } catch (error) {
      logger.error("❌ GroupLock: Error checking lock status", {
        file: "groupLock.ts",
        function: "isLocked",
        groupName,
        error,
      });
      return false;
    }
  }

  async getLockHolder(groupName: string): Promise<string | null> {
    try {
      const lockKey = `group:${groupName}:lock`;
      return await this.redis.get(lockKey);
    } catch (error) {
      logger.error("❌ GroupLock: Error getting lock holder", {
        file: "groupLock.ts",
        function: "getLockHolder",
        groupName,
        error,
      });
      return null;
    }
  }

  async extendLock(groupName: string, holder: string, ttlMs: number = 5000): Promise<boolean> {
    try {
      const lockKey = `group:${groupName}:lock`;
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      
      // Lua script to extend lock only if held by the same holder
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;
      
      const result = await this.redis.eval(script, 1, lockKey, holder, ttlSeconds) as number;
      const extended = result === 1;
      
      logger.debug("⏰ GroupLock: Lock extension attempt", {
        file: "groupLock.ts",
        function: "extendLock",
        lockKey,
        holder,
        ttlMs,
        extended,
      });
      
      return extended;
    } catch (error) {
      logger.error("❌ GroupLock: Error extending lock", {
        file: "groupLock.ts",
        function: "extendLock",
        groupName,
        holder,
        error,
      });
      return false;
    }
  }
} 