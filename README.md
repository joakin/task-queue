# task-queue

`npm install @joakin/task-queue`

A customizable job/task queue for javascript processes.

```js
import { Queue } from "@joakin/task-queue";

const queue = Queue();

queue.add(hardToDoComputation).then(result => console.log(result));
```

- Promise based
- Queued jobs can be cancelled
- Configurable:
  - `queueTimeout`: Time a job spends waiting in the queue
  - `executionTimeout`: Time a job can spend executing
  - `concurrency`: How many jobs should be run concurrently
  - `maxTaskCount`: How many tasks can the queue hold
- All activity is reported via events on the queue for easy logging/monitoring
- Typescript definitions

## Usage

### Creating a queue

Queues are created by default with the following arguments:

```ts
const defaultQueue = Queue({
  queueTimeout: 500,
  executionTimeout: 250,
  concurrency: 1,
  maxTaskCount: 1
});
```

Feel free to pass in only the ones you want to modify when creating one.

### Enqueueing jobs

For adding a job to the queue, just call `queue.add(fn)`, where `fn` is a
function that returns a promise.

The queue will save the closure and run it when it is its turn. When calling
`add`, you get back a `Promise` with a `cancel` method that you can call to
remove the job from the queue.

```ts
queue.add(() => printToPdf(url)).then(pdf => res.send(pdf));
```

### Removing jobs from the queue

When you add a job, you will get back a promise with a `cancel` method that you
can call to remove the job from the queue, whatever its state is (waiting or
running).

```ts
// Timeout example for illustration purposes. You can do timeouts better with the queue parameters though.

const job = queue.add(() => printToPdf(url));
const timeout = setTimeout(() => job.cancel(), 10000);
job.then(pdf => {
  clearTimeout(timeout);
  res.send(pdf);
});
```

You can also specify a callback for when the job is cancelled, by calling
`queue.add(job, onCancel)`. In onCancel you can do cleanup work in case your job
has started running:

```ts
let browser;
const job = queue
  .add(
    () => {
      browser = launchBrowser();
      printToPdf(browser, url);
    },
    () => {
      if (browser) closeBrowser(browser);
    }
  )
  .then(pdf => {
    res.send(pdf);
  });
```

### Queue status

You can get the status of the queue by calling `queue.stats()`:

```ts
console.log(queue.stats());
/*
  {
    jobs: {
      total: 10,
      inProgress: 4,
      waiting: 6
    },
    full: true
  }
*/
```

### Handling errors

There are different error cases for an enqueued job. The promise returned when
enqueueing a job can reject with different types of errors, if you want fine
grained control over the reason why it failed.

For logging/metrics purposes, see next section about events.

```ts
queue.add(job).catch(err => {
  if (err instanceof QueueTimeout) {
    // Item timed out in the queue (queueTimeout configuration option)
  } else if (err instanceof QueueFull) {
    // The queue is full
  } else if (err instanceof JobCancelled) {
    // A job was cancelled
  } else if (err instanceof JobTimeout) {
    // A job timed out when running (executionTimeout configuration option)
  } else {
    // Something else failed when running the job function
  }
});
```

### Monitoring and logging queue activity

The queue instance is also an event emitter, and will emit events for the
activity on the queue that you can listen to.

Events related to queue are under the `queue.*` topic, and events related to
jobs are under the `job.*` topic.

#### Queue events

```ts
// New item added to the queue
queue.on("queue.new", ({ id, inProgressCount, waitingCount }) => {});

// Item timed out in the queue (queueTimeout configuration option)
queue.on("queue.timeout", ({ id, addedToTheQueueAt }) => {});

// The queue is full
queue.on("queue.full", ({ waitingCount, inProgressCount }) => {});
```

#### Job events

```ts
// A job started running
queue.on("job.started", ({ id, addedToTheQueueAt }) => {});

// A job successfully finished
queue.on("job.success", ({ id, addedToTheQueueAt, startedProcessingAt }) => {});

// A job timed out when running (executionTimeout configuration option)
queue.on("job.timeout", ({ id, addedToTheQueueAt, startedProcessingAt }) => {});

// A job was cancelled
queue.on(`job.cancel`, ({ id, addedToTheQueueAt }) => {});

// A job failed when run (promise rejected or running the function threw)
queue.on(
  "job.failure",
  ({ id, addedToTheQueueAt, startedProcessingAt, err }) => {}
);
```

## Types

Here's the type (typescript format) definitions if you want to get a better
understanding of what types the library provides and expects:

```ts
import { EventEmitter } from "events";

export { Queue, JobCancelled, QueueTimeout, QueueFull, JobTimeout };

declare function Queue({
  queueTimeout,
  executionTimeout,
  concurrency,
  maxTaskCount
}?: {
  queueTimeout?: number | undefined;
  executionTimeout?: number | undefined;
  concurrency?: number | undefined;
  maxTaskCount?: number | undefined;
}): QueueInstance;

interface QueueInstance extends EventEmitter {
  add: <T>(
    fn: () => Promise<T>,
    onCancel?: () => void
  ) => CancellablePromise<T>;
  stats(): QueueStats;
}

interface CancellablePromise<T> extends Promise<T> {
  cancel: () => void;
}

interface QueueStats {
  jobs: {
    total: number;
    inProgress: number;
    waiting: number;
  };
  full: boolean;
}

/**
 * Error thrown when job gets cancelled. The promise returned by the
 * queue gets rejected with JobCancelled
 */
declare class JobCancelled extends Error {
  constructor();
}
/**
 * Thrown when task timeouts in the queue
 */
declare class QueueTimeout extends Error {
  addedToTheQueueAt: number;
  constructor(addedToTheQueueAt: number);
}
/**
 * Thrown when there is no space for new task
 */
declare class QueueFull extends Error {
  waitingCount: number;
  inProgressCount: number;
  constructor(waitingCount: number, inProgressCount: number);
}
/**
 * Thrown when task processing takes too much time
 */
declare class JobTimeout extends Error {
  constructor();
}
```

## TODO

- Implementation
  - Review multiple calls to `cleanup` to see if we can remove them
- Testing
  - Add tests for QueueFull
  - Add tests for the event emitting
