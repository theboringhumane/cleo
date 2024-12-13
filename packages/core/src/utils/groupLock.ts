import { Redis } from 'ioredis';

export class GroupLock {
  constructor(private redis: Redis) {}

  async acquireLock(groupName: string, holder: string, ttlMs: number = 5000): Promise<boolean> {
    const lockKey = `group:${groupName}:lock`;
    const result = await this.redis.set(lockKey, holder, 'EX', Math.ceil(ttlMs/1000));
    return result === 'OK';
  }

  async releaseLock(groupName: string, holder: string): Promise<void> {
    const lockKey = `group:${groupName}:lock`;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(script, 1, lockKey, holder);
  }
} 