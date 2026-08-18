import { redisConnection } from '../config/redis';
import { MonkeyCapture } from '../decorators/monkeyLog';

describe('MonkeyCapture', () => {
  const pushed: { key: string; val: string }[] = [];

  beforeEach(() => {
    pushed.length = 0;
    jest.spyOn(redisConnection, 'getInstance').mockReturnValue({
      lpush: jest.fn((key: string, val: string) => {
        pushed.push({ key, val });
        return Promise.resolve(1);
      }),
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('stores jobId and workerId on each log entry', async () => {
    await MonkeyCapture(() => 1)(
      { id: 'job-1', name: 'sendEmail', queueName: 'mail', data: { options: { group: 'g1' } } },
      'worker-1',
      'default',
      { n: 1 }
    );

    expect(pushed[0].key).toBe('cleo:worker:worker-1:task:job-1:logs');
    const parsed = JSON.parse(pushed[0].val);
    expect(parsed.jobId).toBe('job-1');
    expect(parsed.workerId).toBe('worker-1');
    expect(parsed.jobName).toBe('sendEmail');
    expect(parsed.queueName).toBe('mail');
    expect(parsed.group).toBe('g1');
  });

  test('falls back to opts.jobId when job.id missing', async () => {
    await MonkeyCapture(() => 1)({ opts: { jobId: 'job-2' } }, 'worker-2', 'default');

    expect(pushed[0].key).toBe('cleo:worker:worker-2:task:job-2:logs');
    expect(JSON.parse(pushed[0].val).jobId).toBe('job-2');
  });
});
