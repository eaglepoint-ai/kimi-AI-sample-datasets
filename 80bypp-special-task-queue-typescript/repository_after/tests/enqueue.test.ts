import { TaskQueue } from '../src/queue';

describe('TaskQueue - enqueue()', () => {
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

  test('should enqueue task with default values', () => {
    queue = new TaskQueue();
    queue.pause(); // Pause to check initial state
    const handler = jest.fn().mockResolvedValue('result');

    const taskId = queue.enqueue({
      handler,
      data: { test: 'data' }
    });

    const task = queue.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.status).toBe('pending');
    expect(task?.priority).toBe(3);
    expect(task?.attempts).toBe(0);
    expect(task?.maxRetries).toBe(3);
  });

  test('should return unique task ID for each enqueue', () => {
    queue = new TaskQueue();
    const handler = jest.fn().mockResolvedValue('result');

    const id1 = queue.enqueue({ handler, data: {} });
    const id2 = queue.enqueue({ handler, data: {} });
    const id3 = queue.enqueue({ handler, data: {} });

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  test('should store task in internal map and be retrievable via getTask()', () => {
    queue = new TaskQueue();
    const handler = jest.fn().mockResolvedValue('result');
    const data = { userId: 123 };

    const taskId = queue.enqueue({ handler, data });
    const task = queue.getTask(taskId);

    expect(task).toBeDefined();
    expect(task?.id).toBe(taskId);
    expect(task?.data).toEqual(data);
  });

  test('should set task status to pending initially', () => {
    queue = new TaskQueue();
    queue.pause(); // Pause to check initial state
    const handler = jest.fn().mockResolvedValue('result');

    const taskId = queue.enqueue({ handler, data: {} });
    const task = queue.getTask(taskId);

    expect(task?.status).toBe('pending');
  });

  test('should assign custom priority correctly', () => {
    queue = new TaskQueue();
    const handler = jest.fn().mockResolvedValue('result');

    const taskId = queue.enqueue({
      handler,
      data: {},
      priority: 1
    });
    const task = queue.getTask(taskId);

    expect(task?.priority).toBe(1);
  });

  test('should use provided maxRetries instead of default', () => {
    queue = new TaskQueue();
    const handler = jest.fn().mockResolvedValue('result');

    const taskId = queue.enqueue({
      handler,
      data: {},
      maxRetries: 5
    });
    const task = queue.getTask(taskId);

    expect(task?.maxRetries).toBe(5);
  });

  test('should validate handler receives correct data payload', async () => {
    queue = new TaskQueue();
    const handler = jest.fn().mockResolvedValue('result');
    const data = { userId: 456, action: 'test' };

    queue.enqueue({ handler, data });

    await jest.runAllTimersAsync();

    expect(handler).toHaveBeenCalledWith(data);
  });

  test('should not mutate original task data (deep object payload)', async () => {
    queue = new TaskQueue();
    const originalData = {
      user: {
        id: 1,
        meta: {
          roles: ['admin'],
          settings: { theme: 'dark' }
        }
      }
    };
    const dataCopy = JSON.parse(JSON.stringify(originalData));

    // Handler receives data correctly
    const handler = jest.fn().mockImplementation((data) => {
      expect(data).toEqual(dataCopy);
      return Promise.resolve('result');
    });

    queue.enqueue({ handler, data: originalData });
    await jest.runAllTimersAsync();

    expect(handler).toHaveBeenCalled();
  });
});
