import { TaskQueue } from '../src/queue';

describe('TaskQueue - Priority Ordering', () => {
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

  test('high-priority task (1) executes before low-priority task (5)', async () => {
    queue = new TaskQueue({ maxConcurrency: 1 });
    queue.pause(); // Pause to enqueue both before execution
    const executionOrder: number[] = [];

    const lowPriorityHandler = jest.fn().mockImplementation(() => {
      executionOrder.push(5);
      return Promise.resolve('low');
    });

    const highPriorityHandler = jest.fn().mockImplementation(() => {
      executionOrder.push(1);
      return Promise.resolve('high');
    });

    queue.enqueue({ handler: lowPriorityHandler, data: {}, priority: 5 });
    queue.enqueue({ handler: highPriorityHandler, data: {}, priority: 1 });

    queue.resume();
    await jest.runAllTimersAsync();

    expect(executionOrder).toEqual([1, 5]);
  });

  test('FIFO ordering for equal priority tasks', async () => {
    queue = new TaskQueue({ maxConcurrency: 1 });
    const executionOrder: string[] = [];

    const handler1 = jest.fn().mockImplementation(() => {
      executionOrder.push('first');
      return Promise.resolve('1');
    });

    const handler2 = jest.fn().mockImplementation(() => {
      executionOrder.push('second');
      return Promise.resolve('2');
    });

    const handler3 = jest.fn().mockImplementation(() => {
      executionOrder.push('third');
      return Promise.resolve('3');
    });

    queue.enqueue({ handler: handler1, data: {}, priority: 3 });
    queue.enqueue({ handler: handler2, data: {}, priority: 3 });
    queue.enqueue({ handler: handler3, data: {}, priority: 3 });

    await jest.runAllTimersAsync();

    expect(executionOrder).toEqual(['first', 'second', 'third']);
  });

  test('high-priority task added after low-priority tasks must execute first when capacity available', async () => {
    queue = new TaskQueue({ maxConcurrency: 1 });
    const executionOrder: number[] = [];

    queue.pause();

    queue.enqueue({
      handler: () => { executionOrder.push(5); return Promise.resolve(); },
      data: {},
      priority: 5
    });
    queue.enqueue({
      handler: () => { executionOrder.push(4); return Promise.resolve(); },
      data: {},
      priority: 4
    });
    queue.enqueue({
      handler: () => { executionOrder.push(1); return Promise.resolve(); },
      data: {},
      priority: 1
    });

    queue.resume();
    await jest.runAllTimersAsync();

    expect(executionOrder).toEqual([1, 4, 5]);
  });

  test('priority ordering maintained under load (many queued tasks)', async () => {
    queue = new TaskQueue({ maxConcurrency: 1 });
    const executionOrder: number[] = [];

    queue.pause();

    for (let i = 0; i < 10; i++) {
      const priority = (i % 5) + 1 as any;
      queue.enqueue({
        handler: () => { executionOrder.push(priority); return Promise.resolve(); },
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

  test('retried high-priority task should re-enter queue respecting priority', async () => {
    queue = new TaskQueue({ maxConcurrency: 1, defaultRetryBaseDelay: 100 });
    queue.pause(); // Pause initially
    const executionOrder: string[] = [];
    let failCount = 0;

    const highPriorityHandler = jest.fn().mockImplementation(() => {
      executionOrder.push('high-priority');
      if (failCount === 0) {
        failCount++;
        return Promise.reject(new Error('Fail once'));
      }
      return Promise.resolve('success');
    });

    const lowPriorityHandler = jest.fn().mockImplementation(() => {
      executionOrder.push('low-priority');
      return Promise.resolve('low');
    });

    queue.enqueue({ handler: highPriorityHandler, data: {}, priority: 1 });
    queue.enqueue({ handler: lowPriorityHandler, data: {}, priority: 5 });

    queue.resume();
    await jest.runAllTimersAsync();

    // High priority executes first, fails, then retries
    expect(executionOrder[0]).toBe('high-priority');
    // Verify both tasks completed
    expect(executionOrder).toContain('high-priority');
    expect(executionOrder).toContain('low-priority');
    expect(highPriorityHandler).toHaveBeenCalledTimes(2);
  });
});
