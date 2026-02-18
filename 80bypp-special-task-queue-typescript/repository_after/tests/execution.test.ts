import { TaskQueue } from '../src/queue';

describe('TaskQueue - Task Execution', () => {
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

  test('task transitions: pending → running → completed', async () => {
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

  test('handler is automatically executed after enqueue', async () => {
    queue = new TaskQueue();
    const handler = jest.fn().mockResolvedValue('result');

    queue.enqueue({ handler, data: {} });

    await jest.runAllTimersAsync();

    expect(handler).toHaveBeenCalled();
  });

  test('task result is stored correctly on completion', async () => {
    queue = new TaskQueue();
    const expectedResult = { success: true, value: 42 };
    const handler = jest.fn().mockResolvedValue(expectedResult);

    const taskId = queue.enqueue({ handler, data: {} });

    await jest.runAllTimersAsync();

    const task = queue.getTask(taskId);
    expect(task?.result).toEqual(expectedResult);
  });

  test('handler receives correct task data payload', async () => {
    queue = new TaskQueue();
    const data = { userId: 789, action: 'process' };
    const handler = jest.fn().mockResolvedValue('result');

    queue.enqueue({ handler, data });

    await jest.runAllTimersAsync();

    expect(handler).toHaveBeenCalledWith(data);
  });

  test('startedAt and completedAt timestamps are set properly', async () => {
    queue = new TaskQueue();
    queue.pause(); // Pause to check initial state
    const handler = jest.fn().mockResolvedValue('result');

    const taskId = queue.enqueue({ handler, data: {} });

    const taskBefore = queue.getTask(taskId);
    expect(taskBefore?.startedAt).toBeUndefined();
    expect(taskBefore?.completedAt).toBeUndefined();

    queue.resume();
    await jest.runAllTimersAsync();

    const taskAfter = queue.getTask(taskId);
    expect(taskAfter?.startedAt).toBeInstanceOf(Date);
    expect(taskAfter?.completedAt).toBeInstanceOf(Date);
  });

  test('running set is updated correctly during execution', async () => {
    queue = new TaskQueue();
    let isRunning = false;

    const handler = jest.fn().mockImplementation(async () => {
      const stats = queue.getStats();
      isRunning = stats.running === 1;
      return 'result';
    });

    queue.enqueue({ handler, data: {} });

    await jest.runAllTimersAsync();

    expect(isRunning).toBe(true);
    expect(queue.getStats().running).toBe(0);
  });

  test('task transitions: pending → running → failed (after retries exhausted)', async () => {
    queue = new TaskQueue({ defaultRetryBaseDelay: 100 });
    queue.pause(); // Pause to observe pending state

    let taskId: string;
    let runningStateObserved = false;
    const handler = jest.fn().mockImplementation(async () => {
      // Capture running status during execution
      if (queue.getTask(taskId)?.status === 'running') {
        runningStateObserved = true;
      }
      throw new Error('Task failed');
    });

    taskId = queue.enqueue({ handler, data: {}, maxRetries: 2 });

    // Verify initial pending state
    expect(queue.getTask(taskId)?.status).toBe('pending');

    // Resume and complete all attempts
    queue.resume();
    await jest.runAllTimersAsync();

    // Verify running state was observed during execution
    expect(runningStateObserved).toBe(true);

    // Verify final failed state
    expect(queue.getTask(taskId)?.status).toBe('failed');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  test('task transitions: pending → running → timed_out', async () => {
    queue = new TaskQueue({ defaultTimeout: 1000 });
    queue.pause(); // Pause to observe pending state

    let taskId: string;
    let runningStateObserved = false;
    const handler = jest.fn().mockImplementation(() => {
      // Capture running status during execution
      if (queue.getTask(taskId)?.status === 'running') {
        runningStateObserved = true;
      }
      return new Promise(resolve => setTimeout(resolve, 5000));
    });

    taskId = queue.enqueue({ handler, data: {}, maxRetries: 0 });

    // Verify initial pending state
    expect(queue.getTask(taskId)?.status).toBe('pending');

    queue.resume();
    await jest.runAllTimersAsync();

    // Verify running state was observed during execution
    expect(runningStateObserved).toBe(true);

    // Verify final timed_out state
    expect(queue.getTask(taskId)?.status).toBe('timed_out');
  });
});
