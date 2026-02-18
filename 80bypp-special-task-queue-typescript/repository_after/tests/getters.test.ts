import { TaskQueue } from '../src/queue';

describe('TaskQueue - Getters (getTask & getStats)', () => {
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

  describe('getTask()', () => {
    test('should return correct task by ID', () => {
      queue = new TaskQueue();
      queue.pause();
      const handler = jest.fn().mockResolvedValue('result');
      const data = { test: 'data' };

      const taskId = queue.enqueue({ handler, data });
      const task = queue.getTask(taskId);

      expect(task).toBeDefined();
      expect(task?.id).toBe(taskId);
      expect(task?.data).toEqual(data);
    });

    test('should return undefined for non-existent ID', () => {
      queue = new TaskQueue();

      const task = queue.getTask('non-existent-id');

      expect(task).toBeUndefined();
    });

    test('should reflect live task status changes (pending → running → completed)', async () => {
      queue = new TaskQueue();
      queue.pause(); // Pause to observe pending state
      let resolver: any;
      const handler = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          resolver = resolve;
        });
      });

      const taskId = queue.enqueue({ handler, data: {} });

      expect(queue.getTask(taskId)?.status).toBe('pending');

      queue.resume();
      await jest.advanceTimersByTimeAsync(1);
      expect(queue.getTask(taskId)?.status).toBe('running');

      resolver('result');
      await jest.runAllTimersAsync();
      expect(queue.getTask(taskId)?.status).toBe('completed');
    });

    test('should include result and error fields correctly', async () => {
      queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
      const successHandler = jest.fn().mockResolvedValue('success result');
      const failHandler = jest.fn().mockRejectedValue(new Error('fail error'));

      const successId = queue.enqueue({ handler: successHandler, data: {} });
      const failId = queue.enqueue({ handler: failHandler, data: {}, maxRetries: 1 });

      await jest.runAllTimersAsync();

      expect(queue.getTask(successId)?.result).toBe('success result');
      expect(queue.getTask(successId)?.error).toBeUndefined();

      expect(queue.getTask(failId)?.error).toBeInstanceOf(Error);
      expect(queue.getTask(failId)?.error?.message).toBe('fail error');
    });
  });

  describe('getStats()', () => {
    test('should return accurate pending count', () => {
      queue = new TaskQueue();
      queue.pause();
      const handler = jest.fn().mockResolvedValue('result');

      queue.enqueue({ handler, data: {} });
      queue.enqueue({ handler, data: {} });
      queue.enqueue({ handler, data: {} });

      const stats = queue.getStats();
      expect(stats.pending).toBe(3);
      expect(stats.total).toBe(3);
    });

    test('should return accurate running count during execution', async () => {
      queue = new TaskQueue({ maxConcurrency: 2 });
      let statsSnapshot: any;

      const handler = jest.fn().mockImplementation(async () => {
        statsSnapshot = queue.getStats();
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      });

      queue.enqueue({ handler, data: {} });
      queue.enqueue({ handler, data: {} });

      await jest.advanceTimersByTimeAsync(10);

      expect(statsSnapshot.running).toBe(2);
    });

    test('should update completed count after success', async () => {
      queue = new TaskQueue();
      const handler = jest.fn().mockResolvedValue('result');

      queue.enqueue({ handler, data: {} });
      queue.enqueue({ handler, data: {} });

      await jest.runAllTimersAsync();

      const stats = queue.getStats();
      expect(stats.completed).toBe(2);
      expect(stats.total).toBe(2);
    });

    test('should update failed count after retries exhausted', async () => {
      queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
      const handler = jest.fn().mockRejectedValue(new Error('Fail'));

      queue.enqueue({ handler, data: {}, maxRetries: 2 });

      await jest.runAllTimersAsync();

      const stats = queue.getStats();
      expect(stats.failed).toBe(1);
    });

    test('should update timedOut count correctly', async () => {
      queue = new TaskQueue({ defaultTimeout: 1000 });

      const handler = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 5000));
      });

      queue.enqueue({ handler, data: {}, maxRetries: 0 });

      await jest.advanceTimersByTimeAsync(1000);

      const stats = queue.getStats();
      expect(stats.timedOut).toBe(1);
    });

    test('total count should match number of tasks added', async () => {
      queue = new TaskQueue();
      const handler = jest.fn().mockResolvedValue('result');

      queue.enqueue({ handler, data: {} });
      queue.enqueue({ handler, data: {} });
      queue.enqueue({ handler, data: {} });
      queue.enqueue({ handler, data: {} });
      queue.enqueue({ handler, data: {} });

      await jest.runAllTimersAsync();

      const stats = queue.getStats();
      expect(stats.total).toBe(5);
    });
  });
});
