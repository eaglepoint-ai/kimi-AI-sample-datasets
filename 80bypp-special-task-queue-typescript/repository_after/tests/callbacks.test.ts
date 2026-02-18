import { TaskQueue } from '../src/queue';

describe('TaskQueue - Callbacks', () => {
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

  test('onTaskComplete should be called when task completes', async () => {
    queue = new TaskQueue();
    const handler = jest.fn().mockResolvedValue('result');
    const completeCallback = jest.fn();

    queue.onTaskComplete(completeCallback);
    queue.enqueue({ handler, data: {} });

    await jest.runAllTimersAsync();

    expect(completeCallback).toHaveBeenCalledTimes(1);
  });

  test('callback should receive full task object with result', async () => {
    queue = new TaskQueue();
    const expectedResult = { value: 42 };
    const handler = jest.fn().mockResolvedValue(expectedResult);
    const completeCallback = jest.fn();

    queue.onTaskComplete(completeCallback);
    const taskId = queue.enqueue({ handler, data: {} });

    await jest.runAllTimersAsync();

    expect(completeCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        id: taskId,
        status: 'completed',
        result: expectedResult
      })
    );
  });

  test('onTaskFailed should be called after retries exhausted', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
    const handler = jest.fn().mockRejectedValue(new Error('Fail'));
    const failedCallback = jest.fn();

    queue.onTaskFailed(failedCallback);
    queue.enqueue({ handler, data: {}, maxRetries: 2 });

    await jest.runAllTimersAsync();

    expect(failedCallback).toHaveBeenCalledTimes(1);
  });

  test('failed callback should contain final error', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
    const error = new Error('Final error');
    const handler = jest.fn().mockRejectedValue(error);
    const failedCallback = jest.fn();

    queue.onTaskFailed(failedCallback);
    queue.enqueue({ handler, data: {}, maxRetries: 1 });

    await jest.runAllTimersAsync();

    expect(failedCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: error
      })
    );
  });

  test('callback should NOT fire prematurely during retries', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
    let attemptCount = 0;
    const handler = jest.fn().mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 3) {
        return Promise.reject(new Error('Fail'));
      }
      return Promise.resolve('success');
    });
    const completeCallback = jest.fn();
    const failedCallback = jest.fn();

    queue.onTaskComplete(completeCallback);
    queue.onTaskFailed(failedCallback);
    queue.enqueue({ handler, data: {}, maxRetries: 5 });

    await jest.runAllTimersAsync();

    expect(completeCallback).toHaveBeenCalledTimes(1);
    expect(failedCallback).not.toHaveBeenCalled();
  });

  test('onTaskFailed should be called for timed out tasks with no retries', async () => {
    queue = new TaskQueue({ defaultTimeout: 1000 });
    const handler = jest.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 5000));
    });
    const failedCallback = jest.fn();

    queue.onTaskFailed(failedCallback);
    queue.enqueue({ handler, data: {}, maxRetries: 0 });

    await jest.advanceTimersByTimeAsync(1000);

    expect(failedCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'timed_out'
      })
    );
  });
});
