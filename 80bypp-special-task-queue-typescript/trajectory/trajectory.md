# Trajectory - Writing Tests for TaskQueue

## Step 1: Understanding what I'm testing

I read through the TaskQueue implementation. It's an async task queue with priority ordering, retry logic, timeouts, and concurrency control. The requirements say I need to write tests that catch bugs where high-priority tasks execute after low-priority ones, retry delays don't increase exponentially, and timed-out tasks leak resources. I need at least 30 tests covering all methods, state transitions, and timing behavior.

## Step 2: First test - can I enqueue a task?

Started with the simplest thing. Enqueue a task and check it returns an ID. This passed. Then checked that the task starts with status 'pending'. Also passed.

## Step 3: Testing priority ordering - first attempt failed

I wanted to test that priority 1 tasks execute before priority 3 tasks. I enqueued both and checked they were called. This test passed but it's wrong - it doesn't verify the order, just that both were called.

## Step 4: Fixing the priority test

Changed approach to record call order:

```typescript
const callOrder: number[] = [];
const handler1 = jest.fn().mockImplementation(() => {
  callOrder.push(1);
  return Promise.resolve();
});
const handler3 = jest.fn().mockImplementation(() => {
  callOrder.push(3);
  return Promise.resolve();
});

queue.enqueue({ handler: handler3, data: {}, priority: 3 });
queue.enqueue({ handler: handler1, data: {}, priority: 1 });

await new Promise(resolve => setTimeout(resolve, 100));
expect(callOrder).toEqual([1, 3]);
```

This test was flaky. Sometimes it passed, sometimes it failed. The problem was using real timers - the timing was unpredictable.

## Step 5: Switching to fake timers

I needed deterministic timing. Added `jest.useFakeTimers()` in beforeEach. Now I could control time precisely with `jest.advanceTimersByTimeAsync()`. The priority test became reliable.

## Step 6: Testing state transitions - wrong approach

Requirement 17 says I must check state at each lifecycle stage. I tried:

```typescript
const taskId = queue.enqueue({ handler, data: {} });
expect(queue.getTask(taskId)?.status).toBe('pending');

await jest.advanceTimersByTimeAsync(1);
expect(queue.getTask(taskId)?.status).toBe('running');
```

The test failed. Expected 'pending' but got 'running'. The task started executing immediately before I could check the pending state.

## Step 7: Using pause to observe intermediate states

I realized I need to pause the queue before enqueueing:

```typescript
queue.pause();
const taskId = queue.enqueue({ handler, data: {} });
expect(queue.getTask(taskId)?.status).toBe('pending'); // Now works

queue.resume();
await jest.advanceTimersByTimeAsync(1);
expect(queue.getTask(taskId)?.status).toBe('running');
```

But I still had a problem - by the time I check running state, the task might have already completed.

## Step 8: Capturing state from inside the handler

I needed to check the status while the handler is actually running:

```typescript
let resolver: any;
const handler = jest.fn().mockImplementation(() => {
  return new Promise(resolve => { resolver = resolve; });
});

const taskId = queue.enqueue({ handler, data: {} });
queue.resume();
await jest.advanceTimersByTimeAsync(1);
expect(queue.getTask(taskId)?.status).toBe('running'); // Task waiting

resolver('result'); // Now complete it
```

This worked because I control when the promise resolves.

## Step 9: Testing concurrency limits - wrong approach

I set maxConcurrency to 2, enqueued 3 tasks, and checked all 3 were called. This test passed but doesn't prove the limit was enforced. All three could have run simultaneously.

## Step 10: Actually testing concurrency

I needed to capture how many tasks were running at the same time:

```typescript
let maxObserved = 0;
const handler = jest.fn().mockImplementation(async () => {
  const stats = queue.getStats();
  maxObserved = Math.max(maxObserved, stats.running);
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Enqueue 3 tasks...
await jest.runAllTimersAsync();
expect(maxObserved).toBe(2); // Never exceeded 2
```

This correctly verifies the limit.

## Step 11: Testing retry logic - missing the timing

I wrote a test where the handler always rejects, set maxRetries to 3, and checked it was called 3 times. This passed but doesn't verify exponential backoff. A buggy implementation using constant delays would pass.

## Step 12: Testing exponential backoff timing

I needed to verify the actual delays. The formula is `delay = baseDelay * 2^(attempts - 1)`:

```typescript
const callTimes: number[] = [];
handler.mockImplementation(() => {
  callTimes.push(Date.now());
  return Promise.reject(new Error('fail'));
});

queue.enqueue({ handler, data: {}, maxRetries: 4 });

await jest.advanceTimersByTimeAsync(1); // First attempt
expect(handler).toHaveBeenCalledTimes(1);

await jest.advanceTimersByTimeAsync(100); // First retry (100ms)
expect(handler).toHaveBeenCalledTimes(2);
expect(callTimes[1] - callTimes[0]).toBe(100);

await jest.advanceTimersByTimeAsync(200); // Second retry (200ms)
expect(handler).toHaveBeenCalledTimes(3);
expect(callTimes[2] - callTimes[1]).toBe(200);
```

This test actually verifies the exponential backoff formula.

## Step 13: Testing the running set leak - wrong approach

The requirements mention that timed-out tasks leak. I checked that `getStats().running` was 0 after timeout. This test passed even with a buggy implementation because getStats().running is computed from task statuses, not the actual internal running set.

## Step 14: Testing running set leak through side effects

I can't inspect the running set directly, but I can test its side effect. If a task times out but stays in the running set, it will block new tasks:

```typescript
queue = new TaskQueue({ defaultTimeout: 1000, maxConcurrency: 1 });

const firstHandler = jest.fn().mockImplementation(() => {
  return new Promise(resolve => setTimeout(resolve, 5000));
});
const secondHandler = jest.fn().mockResolvedValue('quick');

queue.enqueue({ handler: firstHandler, data: {}, maxRetries: 0 });
queue.enqueue({ handler: secondHandler, data: {}, maxRetries: 0 });

await jest.advanceTimersByTimeAsync(1000); // First times out

await jest.advanceTimersByTimeAsync(1);
expect(secondHandler).toHaveBeenCalledTimes(1); // Should start immediately
```

If the running set isn't cleaned up, secondHandler will never start.

## Step 15: Creating meta-tests to validate test quality

I created 10 intentionally buggy implementations: priority reversed, retry count wrong, constant backoff, timeout not cleared, wrong initial status, concurrency not enforced, running set leak, result not stored, callback not called, pause not working.

For each bug, I swap in the buggy code, run the tests, and verify they fail.

## Step 16: Meta-test revealed weak tests

Ran the meta-tests. Two bugs weren't being caught:

1. The constant backoff bug passed my retry test. I had to add the test from Step 12 that verifies exact delays.

2. The running set leak bug passed because I was checking getStats().running. I had to use the approach from Step 14.

After strengthening these tests, all meta-tests correctly failed.

## Step 17: Adding state transition tests for failure paths

I tried to add pending → running → failed. The test failed at the running check because the task had already failed and moved back to pending for retry.

## Step 18: Capturing running state inside the handler

I declared a variable to track if running state was observed:

```typescript
let taskId: string;
let runningStateObserved = false;
const handler = jest.fn().mockImplementation(async () => {
  if (queue.getTask(taskId)?.status === 'running') {
    runningStateObserved = true;
  }
  throw new Error('fail');
});

taskId = queue.enqueue({ handler, data: {}, maxRetries: 2 });
await jest.runAllTimersAsync();
expect(runningStateObserved).toBe(true);
```

Had to declare taskId before the handler so it's available in the closure.

## Step 19: Fixing a meta-test path bug

Ran the meta-tests and got: "Expected: >= 8, Received: 0". The code was looking in `repository_after/` but test files are in `repository_after/tests/`. Changed the path to include `/tests`.

## Step 20: Removing unnecessary backup file

Noticed the meta-test was creating a `.backup` file. This was redundant since we already store the original code in a variable. Removed the backup file creation and cleanup code.

## Final result

79 tests covering all methods, state transitions, timing behavior, edge cases, and error conditions. All tests pass. Meta-tests confirm that all 10 intentional bugs are caught.

Key lessons:
- Use fake timers for deterministic async testing
- Use pause/resume to observe intermediate states
- Capture state from inside handlers when timing is critical
- Test side effects when you can't inspect private state directly
- Verify exact timing for exponential backoff, not just that retries happen
- Meta-testing reveals weak tests that pass for the wrong reasons
