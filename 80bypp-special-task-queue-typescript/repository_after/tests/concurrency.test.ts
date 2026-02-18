import { TaskQueue } from '../src/queue';

describe('TaskQueue - Concurrency', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (queue) {
      queue.dispose();
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('should not exceed maxConcurrency running tasks simultaneously', async () => {
    queue = new TaskQueue({ maxConcurrency: 2 });
    let maxConcurrent = 0;
    let currentRunning = 0;

    const handler = jest.fn().mockImplementation(async () => {
      currentRunning++;
      maxConcurrent = Math.max(maxConcurrent, currentRunning);
      await new Promise(resolve => setTimeout(resolve, 100));
      currentRunning--;
      return 'result';
    });

    queue.enqueue({ handler, data: {} });
    queue.enqueue({ handler, data: {} });
    queue.enqueue({ handler, data: {} });
    queue.enqueue({ handler, data: {} });

    await jest.runAllTimersAsync();

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  test('next queued task should start immediately after one completes', async () => {
    queue = new TaskQueue({ maxConcurrency: 1 });
    const executionTimes: number[] = [];

    const handler = jest.fn().mockImplementation(async () => {
      executionTimes.push(Date.now());
      return 'result';
    });

    queue.enqueue({ handler, data: {} });
    queue.enqueue({ handler, data: {} });

    await jest.runAllTimersAsync();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(executionTimes.length).toBe(2);
  });

  test('concurrency = 1 should enforce strict sequential execution', async () => {
    queue = new TaskQueue({ maxConcurrency: 1 });
    const executionOrder: number[] = [];
    let currentlyExecuting = 0;

    const createHandler = (id: number) => jest.fn().mockImplementation(async () => {
      currentlyExecuting++;
      expect(currentlyExecuting).toBe(1);
      executionOrder.push(id);
      await new Promise(resolve => setTimeout(resolve, 10));
      currentlyExecuting--;
      return 'result';
    });

    queue.enqueue({ handler: createHandler(1), data: {} });
    queue.enqueue({ handler: createHandler(2), data: {} });
    queue.enqueue({ handler: createHandler(3), data: {} });

    await jest.runAllTimersAsync();

    expect(executionOrder).toEqual([1, 2, 3]);
  });

  test('multiple fast tasks should not violate concurrency limit', async () => {
    queue = new TaskQueue({ maxConcurrency: 3 });
    let maxConcurrent = 0;
    let currentRunning = 0;

    const handler = jest.fn().mockImplementation(() => {
      currentRunning++;
      maxConcurrent = Math.max(maxConcurrent, currentRunning);
      return Promise.resolve().then(() => {
        currentRunning--;
        return 'result';
      });
    });

    for (let i = 0; i < 10; i++) {
      queue.enqueue({ handler, data: {} });
    }

    await jest.runAllTimersAsync();

    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });
});
