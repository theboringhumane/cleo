import Redis from "ioredis-mock";
import type { Redis as RedisType } from "ioredis";
import { TaskObserver } from "../observers/taskObserver";
import { ObserverEvent, TaskStatus } from '../types/enums';

describe('TaskObserver', () => {
  let redis: RedisType;
  let observer: TaskObserver;

  beforeEach(() => {
    redis = new Redis() as unknown as RedisType;
    observer = new TaskObserver(redis);
  });

  test('should notify subscribers on status change', done => {
    const callback = (taskId: string, status: TaskStatus) => {
      expect(taskId).toBe('task1');
      expect(status).toBe(TaskStatus.COMPLETED);
      done();
    };

    observer.subscribe(ObserverEvent.STATUS_CHANGE, callback);
    observer.notify(ObserverEvent.STATUS_CHANGE, 'task1', TaskStatus.COMPLETED);
  });
}); 