import { TaskQueue } from '../src/queue';

describe('TaskQueue - Control (pause/resume/clear)', () => {
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

  describe('pause/resume()', () => {
    test('pause() should stop new task processing', async () => {
      queue = new TaskQueue();
      const handler = jest.fn().mockResolvedValue('result');

      queue.pause();
      queue.enqueue({ handler, data: {} });

      await jest.advanceTimersByTimeAsync(1000);

      expect(handler).not.toHaveBeenCalled();
    });

    test('running tasks should continue while paused', async () => {
      queue = new TaskQueue({ maxConcurrency: 1 });
      let firstTaskCompleted = false;

      const firstHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        firstTaskCompleted = true;
        return 'first';
      });

      const secondHandler = jest.fn().mockResolvedValue('second');

      queue.enqueue({ handler: firstHandler, data: {} });

      await jest.advanceTimersByTimeAsync(10);
      queue.pause();
      queue.enqueue({ handler: secondHandler, data: {} });

      await jest.runAllTimersAsync();

      expect(firstTaskCompleted).toBe(true);
      expect(secondHandler).not.toHaveBeenCalled();
    });

    test('resume() should restart processing of queued tasks', async () => {
      queue = new TaskQueue();
      const handler = jest.fn().mockResolvedValue('result');

      queue.pause();
      queue.enqueue({ handler, data: {} });
      queue.enqueue({ handler, data: {} });

      await jest.advanceTimersByTimeAsync(1000);
      expect(handler).not.toHaveBeenCalled();

      queue.resume();
      await jest.runAllTimersAsync();

      expect(handler).toHaveBeenCalledTimes(2);
    });

    test('enqueue while paused should not auto-execute until resume', async () => {
      queue = new TaskQueue();
      const handler = jest.fn().mockResolvedValue('result');

      queue.pause();
      const taskId = queue.enqueue({ handler, data: {} });

      await jest.advanceTimersByTimeAsync(1000);
      expect(queue.getTask(taskId)?.status).toBe('pending');

      queue.resume();
      await jest.runAllTimersAsync();

      expect(queue.getTask(taskId)?.status).toBe('completed');
    });
  });

  describe('clear()', () => {
    test('clear() should remove all pending tasks', () => {
      queue = new TaskQueue();
      queue.pause();
      const handler = jest.fn().mockResolvedValue('result');

      queue.enqueue({ handler, data: {} });
      queue.enqueue({ handler, data: {} });
      queue.enqueue({ handler, data: {} });

      expect(queue.getStats().pending).toBe(3);

      queue.clear();

      expect(queue.getStats().pending).toBe(0);
      expect(queue.getStats().total).toBe(0);
    });

    test('clear() should NOT affect running tasks', async () => {
      queue = new TaskQueue({ maxConcurrency: 1 });
      let runningTaskCompleted = false;

      const runningHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        runningTaskCompleted = true;
        return 'running';
      });

      const pendingHandler = jest.fn().mockResolvedValue('pending');

      const runningId = queue.enqueue({ handler: runningHandler, data: {} });

      await jest.advanceTimersByTimeAsync(10);

      queue.enqueue({ handler: pendingHandler, data: {} });
      queue.clear();

      await jest.runAllTimersAsync();

      expect(runningTaskCompleted).toBe(true);
      expect(queue.getTask(runningId)?.status).toBe('completed');
      expect(pendingHandler).not.toHaveBeenCalled();
    });

    test('stats pending count should reset after clear', () => {
      queue = new TaskQueue();
      queue.pause();
      const handler = jest.fn().mockResolvedValue('result');

      queue.enqueue({ handler, data: {} });
      queue.enqueue({ handler, data: {} });

      expect(queue.getStats().pending).toBe(2);

      queue.clear();

      expect(queue.getStats().pending).toBe(0);
    });

    test('clear() should cancel retry timers for pending tasks', async () => {
      queue = new TaskQueue({ defaultRetryBaseDelay: 1000 });
      queue.pause(); // Pause to keep tasks pending
      const handler = jest.fn().mockRejectedValue(new Error('Fail'));

      queue.enqueue({ handler, data: {}, maxRetries: 3 });
      queue.enqueue({ handler, data: {}, maxRetries: 3 });

      // Clear while tasks are still pending
      queue.clear();

      queue.resume();
      await jest.runAllTimersAsync();

      // No tasks should execute after clear
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('dispose()', () => {
    test('dispose() should clear all timers and stop processing', async () => {
      queue = new TaskQueue({ defaultRetryBaseDelay: 1000 });
      const handler = jest.fn().mockRejectedValue(new Error('Fail'));

      queue.enqueue({ handler, data: {}, maxRetries: 5 });

      await jest.advanceTimersByTimeAsync(10);

      queue.dispose();

      await jest.runAllTimersAsync();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
