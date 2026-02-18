import { TaskQueue } from '../src/queue';

describe('TaskQueue - Timeout Handling', () => {
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

  test('task exceeding defaultTimeout should be marked as timed_out', async () => {
    queue = new TaskQueue({ defaultTimeout: 1000 });

    const handler = jest.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 5000));
    });

    const taskId = queue.enqueue({ handler, data: {}, maxRetries: 0 });

    await jest.advanceTimersByTimeAsync(1000);

    const task = queue.getTask(taskId);
    expect(task?.status).toBe('timed_out');
  });

  test('timed-out task should trigger retry if retries remain', async () => {
    queue = new TaskQueue({ defaultTimeout: 1000, defaultRetryBaseDelay: 500 });
    let callCount = 0;

    const handler = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call times out
        return new Promise(resolve => setTimeout(resolve, 5000));
      }
      // Second call succeeds quickly
      return Promise.resolve('success');
    });

    const taskId = queue.enqueue({ handler, data: {}, maxRetries: 2 });

    // First attempt times out
    await jest.advanceTimersByTimeAsync(1000);
    expect(handler).toHaveBeenCalledTimes(1);

    // Wait for retry delay
    await jest.advanceTimersByTimeAsync(500);

    // Second attempt completes
    await jest.runAllTimersAsync();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(queue.getTask(taskId)?.status).toBe('completed');
  });

  test('timeout timer should be cleared when task completes early', async () => {
    queue = new TaskQueue({ defaultTimeout: 5000 });

    const handler = jest.fn().mockResolvedValue('quick result');

    const taskId = queue.enqueue({ handler, data: {} });

    await jest.runAllTimersAsync();

    const task = queue.getTask(taskId);
    expect(task?.status).toBe('completed');
    expect(task?.status).not.toBe('timed_out');
  });

  test('task that resolves AFTER timeout should NOT overwrite timed_out state', async () => {
    queue = new TaskQueue({ defaultTimeout: 1000 });
    let resolver: any;

    const handler = jest.fn().mockImplementation(() => {
      return new Promise(resolve => {
        resolver = resolve;
      });
    });

    const taskId = queue.enqueue({ handler, data: {}, maxRetries: 0 });

    await jest.advanceTimersByTimeAsync(1000);
    expect(queue.getTask(taskId)?.status).toBe('timed_out');

    resolver('late result');
    await jest.runAllTimersAsync();

    expect(queue.getTask(taskId)?.status).toBe('timed_out');
  });

  test('running set should remove timed-out task (leak prevention)', async () => {
    queue = new TaskQueue({ defaultTimeout: 1000 });

    const handler = jest.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 5000));
    });

    queue.enqueue({ handler, data: {}, maxRetries: 0 });

    await jest.advanceTimersByTimeAsync(500);
    expect(queue.getStats().running).toBe(1);

    await jest.advanceTimersByTimeAsync(500);
    expect(queue.getStats().running).toBe(0);
  });

  test('running set must be cleaned immediately on timeout', async () => {
    queue = new TaskQueue({ defaultTimeout: 1000, maxConcurrency: 1 });
    const firstHandler = jest.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 5000));
    });
    const secondHandler = jest.fn().mockResolvedValue('quick');

    // First task will timeout
    queue.enqueue({ handler: firstHandler, data: {}, maxRetries: 0 });

    // Second task should be able to start after first times out
    queue.enqueue({ handler: secondHandler, data: {}, maxRetries: 0 });

    // First task starts
    await jest.advanceTimersByTimeAsync(1);
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledTimes(0);

    // First task times out
    await jest.advanceTimersByTimeAsync(1000);

    // Second task MUST start immediately after first times out
    // If running set wasn't cleaned, second task won't start due to concurrency limit
    await jest.advanceTimersByTimeAsync(1);
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });

  test('multiple timed-out tasks all cleaned from running set', async () => {
    queue = new TaskQueue({ defaultTimeout: 1000, maxConcurrency: 2 });
    const slowHandler = jest.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 5000));
    });
    const fastHandler = jest.fn().mockResolvedValue('done');

    // Two tasks that will timeout
    queue.enqueue({ handler: slowHandler, data: {}, maxRetries: 0 });
    queue.enqueue({ handler: slowHandler, data: {}, maxRetries: 0 });

    // Two tasks that should run after timeouts
    queue.enqueue({ handler: fastHandler, data: {}, maxRetries: 0 });
    queue.enqueue({ handler: fastHandler, data: {}, maxRetries: 0 });

    // First two start
    await jest.advanceTimersByTimeAsync(1);
    expect(slowHandler).toHaveBeenCalledTimes(2);
    expect(fastHandler).toHaveBeenCalledTimes(0);

    // Both timeout
    await jest.advanceTimersByTimeAsync(1000);

    // Next two MUST start immediately
    // If running set wasn't cleaned, they won't start due to concurrency limit
    await jest.advanceTimersByTimeAsync(1);
    expect(fastHandler).toHaveBeenCalledTimes(2);
  });
});
