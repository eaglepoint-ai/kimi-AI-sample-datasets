import { TaskQueue } from '../src/queue';

describe('TaskQueue - Retry Logic', () => {
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

  test('failed task should retry until maxRetries is reached', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
    const handler = jest.fn().mockRejectedValue(new Error('Always fails'));

    const taskId = queue.enqueue({ handler, data: {}, maxRetries: 3 });

    await jest.runAllTimersAsync();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(queue.getTask(taskId)?.status).toBe('failed');
  });

  test('should NOT exceed maxRetries attempts', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
    const handler = jest.fn().mockRejectedValue(new Error('Fail'));

    queue.enqueue({ handler, data: {}, maxRetries: 2 });

    await jest.runAllTimersAsync();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).not.toHaveBeenCalledTimes(3);
  });

  test('exponential backoff delay = baseDelay * 2^(attempts - 1)', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 1000 });
    const handler = jest.fn().mockRejectedValue(new Error('Fail'));
    const retryTimes: number[] = [];

    handler.mockImplementation(() => {
      retryTimes.push(Date.now());
      return Promise.reject(new Error('Fail'));
    });

    queue.enqueue({ handler, data: {}, maxRetries: 3 });

    await jest.advanceTimersByTimeAsync(1);
    expect(retryTimes.length).toBe(1);

    await jest.advanceTimersByTimeAsync(1000);
    expect(retryTimes.length).toBe(2);

    await jest.advanceTimersByTimeAsync(2000);
    expect(retryTimes.length).toBe(3);

    await jest.runAllTimersAsync();
  });

  test('task succeeding on retry should be marked completed with correct attempts', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
    let attemptCount = 0;

    const handler = jest.fn().mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 3) {
        return Promise.reject(new Error('Fail'));
      }
      return Promise.resolve('success');
    });

    const taskId = queue.enqueue({ handler, data: {}, maxRetries: 5 });

    await jest.runAllTimersAsync();

    const task = queue.getTask(taskId);
    expect(task?.status).toBe('completed');
    expect(task?.attempts).toBe(3);
    expect(task?.result).toBe('success');
  });

  test('task exhausting retries should be marked as failed with last error recorded', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
    const lastError = new Error('Final failure');
    let attemptCount = 0;

    const handler = jest.fn().mockImplementation(() => {
      attemptCount++;
      if (attemptCount === 3) {
        return Promise.reject(lastError);
      }
      return Promise.reject(new Error('Earlier failure'));
    });

    const taskId = queue.enqueue({ handler, data: {}, maxRetries: 3 });

    await jest.runAllTimersAsync();

    const task = queue.getTask(taskId);
    expect(task?.status).toBe('failed');
    expect(task?.error).toBe(lastError);
    expect(task?.attempts).toBe(3);
  });

  test('retry should reset task status back to pending before re-queue', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 100, maxConcurrency: 1 });
    let attemptCount = 0;

    const handler = jest.fn().mockImplementation(() => {
      attemptCount++;
      if (attemptCount === 1) {
        return Promise.reject(new Error('Fail'));
      }
      return Promise.resolve('success');
    });

    const taskId = queue.enqueue({ handler, data: {} });

    await jest.advanceTimersByTimeAsync(50);
    expect(queue.getTask(taskId)?.status).toBe('pending');

    await jest.runAllTimersAsync();
  });

  test('zero-delay retry should not cause infinite loop', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 0 });
    const handler = jest.fn().mockRejectedValue(new Error('Fail'));

    queue.enqueue({ handler, data: {}, maxRetries: 3 });

    await jest.runAllTimersAsync();

    expect(handler).toHaveBeenCalledTimes(3);
  });

  test('exponential backoff timing is strictly enforced', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
    const handler = jest.fn().mockRejectedValue(new Error('Fail'));
    const callTimes: number[] = [];

    handler.mockImplementation(() => {
      callTimes.push(Date.now());
      return Promise.reject(new Error('Fail'));
    });

    queue.enqueue({ handler, data: {}, maxRetries: 4 });

    // First attempt
    await jest.advanceTimersByTimeAsync(1);
    expect(handler).toHaveBeenCalledTimes(1);

    // Second attempt after 100ms (baseDelay * 2^0)
    await jest.advanceTimersByTimeAsync(100);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(callTimes[1] - callTimes[0]).toBe(100);

    // Third attempt after 200ms (baseDelay * 2^1)
    await jest.advanceTimersByTimeAsync(200);
    expect(handler).toHaveBeenCalledTimes(3);
    expect(callTimes[2] - callTimes[1]).toBe(200);

    // Fourth attempt after 400ms (baseDelay * 2^2)
    await jest.advanceTimersByTimeAsync(400);
    expect(handler).toHaveBeenCalledTimes(4);
    expect(callTimes[3] - callTimes[2]).toBe(400);

    await jest.runAllTimersAsync();
  });
});
