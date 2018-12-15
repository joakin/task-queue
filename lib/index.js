"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
function Queue({ queueTimeout = 500, executionTimeout = 250, concurrency = 1, maxTaskCount = 1 } = {}) {
    let events = new events_1.EventEmitter();
    let lastId = 0;
    const waitingJobs = [];
    const inProgressJobs = [];
    const timeouts = new Map();
    let processing = false;
    function removeTimeout(id) {
        if (timeouts.has(id)) {
            clearTimeout(timeouts.get(id));
            timeouts.delete(id);
        }
    }
    function setUpQueueTimeout(job, reject) {
        timeouts.set(job.id, setTimeout(() => {
            events.emit("queue.timeout", {
                id: job.id,
                addedToTheQueueAt: job.addedToTheQueueAt
            });
            removeTimeout(job.id);
            reject(new QueueTimeout(job.addedToTheQueueAt));
        }, queueTimeout));
    }
    function setUpProcessingTimeout(job, reject) {
        timeouts.set(job.id, setTimeout(() => {
            events.emit("job.timeout", {
                id: job.id,
                addedToTheQueueAt: job.addedToTheQueueAt,
                startedProcessingAt: job.startedProcessingAt
            });
            job.cancel();
            reject(new JobTimeout());
        }, executionTimeout));
    }
    function cleanup(job) {
        removeTimeout(job.id);
        removeJob(job);
    }
    function removeJob(job) {
        let arr = waitingJobs;
        let i = waitingJobs.findIndex(j => job.id === j.job.id);
        if (i == -1) {
            arr = inProgressJobs;
            i = inProgressJobs.findIndex(j => job.id === j.job.id);
        }
        if (i != -1) {
            arr.splice(i, 1);
        }
    }
    function add(fn, onCancel) {
        if (isFull()) {
            const waitingCount = waitingJobs.length;
            const inProgressCount = inProgressJobs.length;
            events.emit("queue.full", {
                waitingCount,
                inProgressCount
            });
            return cancellable(Promise.reject(new QueueFull(waitingCount, inProgressCount)), () => { });
        }
        const job = {
            fn,
            cancel: function () {
                onCancel && onCancel();
                cleanup(job);
            },
            id: lastId++,
            addedToTheQueueAt: Date.now(),
            startedProcessingAt: null
        };
        let reject;
        const promise = cancellable(new Promise((resolve, reject_) => {
            reject = reject_;
            setUpQueueTimeout(job, reject);
            waitingJobs.push({
                job,
                reject,
                resolve
            });
            const waitingCount = waitingJobs.length;
            const inProgressCount = inProgressJobs.length;
            events.emit("queue.new", {
                id: job.id,
                inProgressCount,
                waitingCount
            });
            processQueue();
        }).finally(() => {
            cleanup(job);
            processQueue();
        }), function cancel() {
            job.cancel();
            events.emit(`job.cancel`, {
                id: job.id,
                addedToTheQueueAt: job.addedToTheQueueAt
            });
            reject && reject(new JobCancelled());
        });
        return promise;
    }
    function isFull() {
        return waitingJobs.length + inProgressJobs.length >= maxTaskCount;
    }
    function processQueue() {
        if (inProgressJobs.length >= concurrency || processing) {
            return;
        }
        const jobWithFunctions = waitingJobs.shift();
        if (!jobWithFunctions)
            return;
        const { job, reject, resolve } = jobWithFunctions;
        processing = true;
        removeTimeout(job.id);
        inProgressJobs.push({ job, reject, resolve });
        setUpProcessingTimeout(job, reject);
        try {
            job.startedProcessingAt = Date.now();
            events.emit("job.started", {
                id: job.id,
                addedToTheQueueAt: job.addedToTheQueueAt
            });
            processJob(job, resolve, reject);
        }
        catch (err) {
            events.emit("job.failure", {
                id: job.id,
                addedToTheQueueAt: job.addedToTheQueueAt,
                startedProcessingAt: job.startedProcessingAt,
                err
            });
            reject(err);
            cleanup(job);
        }
        processing = false;
    }
    function processJob(job, resolve, reject) {
        job.fn().then((...results) => {
            events.emit("job.success", {
                id: job.id,
                addedToTheQueueAt: job.addedToTheQueueAt,
                startedProcessingAt: job.startedProcessingAt
            });
            cleanup(job);
            resolve(...results);
            processQueue();
        }, err => {
            events.emit("job.failure", {
                id: job.id,
                addedToTheQueueAt: job.addedToTheQueueAt,
                startedProcessingAt: job.startedProcessingAt,
                err
            });
            cleanup(job);
            reject(err);
            processQueue();
        });
    }
    return Object.assign(events, {
        add,
        stats() {
            return {
                jobs: {
                    total: waitingJobs.length + inProgressJobs.length,
                    inProgress: inProgressJobs.length,
                    waiting: waitingJobs.length
                },
                full: isFull()
            };
        }
    });
}
exports.Queue = Queue;
/**
 * Error thrown when job gets cancelled. The promise returned by the
 * queue gets rejected with JobCancelled
 */
class JobCancelled extends Error {
    constructor() {
        super();
        Error.captureStackTrace(this, JobCancelled);
    }
}
exports.JobCancelled = JobCancelled;
/**
 * Thrown when task timeouts in the queue
 */
class QueueTimeout extends Error {
    constructor(addedToTheQueueAt) {
        super();
        this.addedToTheQueueAt = addedToTheQueueAt;
        Error.captureStackTrace(this, QueueTimeout);
    }
}
exports.QueueTimeout = QueueTimeout;
/**
 * Thrown when there is no space for new task
 */
class QueueFull extends Error {
    constructor(waitingCount, inProgressCount) {
        super();
        this.waitingCount = waitingCount;
        this.inProgressCount = inProgressCount;
        Error.captureStackTrace(this, QueueFull);
    }
}
exports.QueueFull = QueueFull;
/**
 * Thrown when task processing takes too much time
 */
class JobTimeout extends Error {
    constructor() {
        super();
        Error.captureStackTrace(this, JobTimeout);
    }
}
exports.JobTimeout = JobTimeout;
function cancellable(promise, cancel) {
    promise.cancel = cancel;
    return promise;
}
//# sourceMappingURL=index.js.map