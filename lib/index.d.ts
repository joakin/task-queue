/// <reference types="node" />
import { EventEmitter } from "events";
interface CancellablePromise<T> extends Promise<T> {
    cancel: () => void;
}
interface QueueInstance extends EventEmitter {
    add: <T>(fn: () => Promise<T>, onCancel?: () => void) => CancellablePromise<T>;
    stats(): QueueStats;
}
interface QueueStats {
    jobs: {
        total: number;
        inProgress: number;
        waiting: number;
    };
    full: boolean;
}
declare function Queue({ queueTimeout, executionTimeout, concurrency, maxTaskCount }?: {
    queueTimeout?: number | undefined;
    executionTimeout?: number | undefined;
    concurrency?: number | undefined;
    maxTaskCount?: number | undefined;
}): QueueInstance;
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
export { Queue, JobCancelled, QueueTimeout, QueueFull, JobTimeout };
