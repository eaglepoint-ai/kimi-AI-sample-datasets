import { TaskQueue } from '../src/queue';

describe('TaskQueue - Validation & Error Handling', () => {
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

  test('should throw if handler is missing', () => {
    queue = new TaskQueue();

    expect(() => {
      queue.enqueue({ data: {} } as any);
    }).toThrow('Task handler must be a function');
  });

  test('should throw if handler is not a function', () => {
    queue = new TaskQueue();

    expect(() => {
      queue.enqueue({ handler: 'not a function', data: {} } as any);
    }).toThrow('Task handler must be a function');
  });

  test('should throw if priority < 1', () => {
    queue = new TaskQueue();
    const handler = jest.fn().mockResolvedValue('result');

    expect(() => {
      queue.enqueue({ handler, data: {}, priority: 0 as any });
    }).toThrow('Priority must be an integer between 1 and 5');
  });

  test('should throw if priority > 5', () => {
    queue = new TaskQueue();
    const handler = jest.fn().mockResolvedValue('result');

    expect(() => {
      queue.enqueue({ handler, data: {}, priority: 6 as any });
    }).toThrow('Priority must be an integer between 1 and 5');
  });

  test('should throw if priority is non-integer', () => {
    queue = new TaskQueue();
    const handler = jest.fn().mockResolvedValue('result');

    expect(() => {
      queue.enqueue({ handler, data: {}, priority: 2.5 as any });
    }).toThrow('Priority must be an integer between 1 and 5');
  });

  test('should throw if maxRetries is negative', () => {
    queue = new TaskQueue();
    const handler = jest.fn().mockResolvedValue('result');

    expect(() => {
      queue.enqueue({ handler, data: {}, maxRetries: -1 });
    }).toThrow('maxRetries must be a non-negative integer');
  });

  test('should throw when enqueue is called after dispose()', () => {
    queue = new TaskQueue();
    const handler = jest.fn().mockResolvedValue('result');

    queue.dispose();

    expect(() => {
      queue.enqueue({ handler, data: {} });
    }).toThrow('Cannot enqueue tasks on a disposed queue');
  });

  test('constructor with maxConcurrency = 0 should throw', () => {
    expect(() => {
      new TaskQueue({ maxConcurrency: 0 });
    }).toThrow('maxConcurrency must be at least 1');
  });
});
