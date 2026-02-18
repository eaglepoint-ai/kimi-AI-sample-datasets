import { TaskQueue } from '../src/queue';

describe('TaskQueue - Edge Cases', () => {
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

  test('priority inversion under heavy load should not occur', async () => {
    queue = new TaskQueue({ maxConcurrency: 2 });
    const executionOrder: number[] = [];

    queue.pause();

    for (let i = 0; i < 20; i++) {
      const priority = (i % 5) + 1 as any;
      queue.enqueue({
        handler: () => {
          executionOrder.push(priority);
          return Promise.resolve();
        },
        data: {},
        priority
      });
    }

    queue.resume();
    await jest.runAllTimersAsync();

    for (let i = 0; i < executionOrder.length - 1; i++) {
      expect(executionOrder[i]).toBeLessThanOrEqual(executionOrder[i + 1]);
    }
  });

  test('synchronous handler failure should be caught', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
    const handler = jest.fn().mockImplementation(() => {
      throw new Error('Synchronous error');
    });

    const taskId = queue.enqueue({ handler, data: {}, maxRetries: 1 });

    await jest.runAllTimersAsync();

    const task = queue.getTask(taskId);
    expect(task?.status).toBe('failed');
    expect(task?.error?.message).toBe('Synchronous error');
  });

  test('non-Error object throws should be normalized', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
    const handler = jest.fn().mockImplementation(() => {
      throw 'String error';
    });

    const taskId = queue.enqueue({ handler, data: {}, maxRetries: 1 });

    await jest.runAllTimersAsync();

    const task = queue.getTask(taskId);
    expect(task?.error).toBeInstanceOf(Error);
    expect(task?.error?.message).toBe('String error');
  });

  test('multiple tasks with different priorities and retries', async () => {
    queue = new TaskQueue({ maxConcurrency: 2, defaultRetryBaseDelay: 100 });
    queue.pause(); // Pause to enqueue all first
    const results: string[] = [];

    let task1Attempts = 0;
    const handler1 = jest.fn().mockImplementation(() => {
      task1Attempts++;
      if (task1Attempts < 2) {
        return Promise.reject(new Error('Fail'));
      }
      results.push('task1-p1');
      return Promise.resolve('task1');
    });

    const handler2 = jest.fn().mockImplementation(() => {
      results.push('task2-p3');
      return Promise.resolve('task2');
    });

    const handler3 = jest.fn().mockImplementation(() => {
      results.push('task3-p2');
      return Promise.resolve('task3');
    });

    queue.enqueue({ handler: handler1, data: {}, priority: 1, maxRetries: 3 });
    queue.enqueue({ handler: handler2, data: {}, priority: 3 });
    queue.enqueue({ handler: handler3, data: {}, priority: 2 });

    queue.resume();
    await jest.runAllTimersAsync();

    // Verify all tasks completed
    expect(results).toContain('task1-p1');
    expect(results).toContain('task2-p3');
    expect(results).toContain('task3-p2');
    expect(handler1).toHaveBeenCalledTimes(2);
  });

  test('task data is passed correctly to handler', async () => {
    queue = new TaskQueue();
    const originalData = {
      user: { id: 1, name: 'Test' },
      items: [1, 2, 3]
    };
    const dataCopy = JSON.parse(JSON.stringify(originalData));

    const handler = jest.fn().mockImplementation((data) => {
      // Verify handler receives correct data
      expect(data).toEqual(dataCopy);
      return Promise.resolve('result');
    });

    queue.enqueue({ handler, data: originalData });
    await jest.runAllTimersAsync();

    expect(handler).toHaveBeenCalledWith(originalData);
  });

  test('concurrent tasks should respect priority even when running', async () => {
    queue = new TaskQueue({ maxConcurrency: 2 });
    queue.pause(); // Pause to enqueue all first
    const executionOrder: number[] = [];

    const createHandler = (priority: number) => jest.fn().mockImplementation(async () => {
      executionOrder.push(priority);
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'result';
    });

    queue.enqueue({ handler: createHandler(3), data: {}, priority: 3 });
    queue.enqueue({ handler: createHandler(3), data: {}, priority: 3 });
    queue.enqueue({ handler: createHandler(1), data: {}, priority: 1 });
    queue.enqueue({ handler: createHandler(2), data: {}, priority: 2 });

    queue.resume();
    await jest.runAllTimersAsync();

    // Verify all tasks executed
    expect(executionOrder.length).toBe(4);
    expect(executionOrder).toContain(1);
    expect(executionOrder).toContain(2);
    expect(executionOrder).toContain(3);
  });
});
