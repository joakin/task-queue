"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test = require("tape");
const index_1 = require("./index");
process.on("unhandledRejection", err => {
    console.error("Unhandled rejection");
    console.error(err);
    process.exit(1);
});
test("registers and processes task correctly", assert => {
    assert.plan(4);
    const q = index_1.Queue();
    assert.equal(q.stats().jobs.total, 0, "No jobs in the queue");
    q.add(async () => "one")
        .then(result => {
        assert.equal(result, "one");
    })
        .finally(() => {
        assert.equal(q.stats().jobs.total, 0, "No jobs in the queue at the end");
    });
    assert.equal(q.stats().jobs.total, 1, "One job in the queue after adding");
});
test("rejects new job when queue is busy", assert => {
    assert.plan(4);
    const q = index_1.Queue();
    assert.equal(q.stats().full, false, "should not be full");
    q.add(async () => "one").finally(() => {
        assert.equal(q.stats().full, false, "should not be full");
    });
    assert.equal(q.stats().full, true, "should be full");
    q.add(async () => "two").catch(error => {
        assert.ok(error instanceof index_1.QueueFull, "second task rejects because the queue is full");
    });
});
test("resolves promises in correct order", assert => {
    assert.plan(12);
    const q = index_1.Queue({
        concurrency: 1,
        maxTaskCount: 5,
        queueTimeout: 500,
        executionTimeout: 500
    });
    let tests = 0;
    // first worker must finish after 0.25 sec
    q.add(() => after(250, "one")).then(result => {
        assert.equal(result, "one");
        assert.equal(tests, 0);
        tests++;
    });
    assert.equal(q.stats().jobs.total, 1);
    assert.equal(q.stats().jobs.inProgress, 1);
    // second worker must finish 0.1 sec after the first one
    q.add(() => after(100, "two")).then(result => {
        assert.equal(result, "two");
        assert.equal(tests, 1);
        tests++;
    });
    assert.equal(q.stats().jobs.total, 2);
    assert.equal(q.stats().jobs.inProgress, 1);
    // the last worker must finish last, regardless of the timeout
    q.add(() => after(20, "three")).then(result => {
        assert.equal(result, "three");
        assert.equal(tests, 2);
    });
    assert.equal(q.stats().jobs.total, 3);
    assert.equal(q.stats().jobs.inProgress, 1);
});
test("resolves concurrent promises in correct order", assert => {
    assert.plan(17);
    const q = index_1.Queue({
        concurrency: 2,
        maxTaskCount: 5,
        queueTimeout: 500,
        executionTimeout: 500
    });
    let finishedTests = 0;
    // first worker must finish after 0.25 sec
    q.add(() => after(250, "one"))
        .then(result => {
        assert.equal(result, "one", "Task once returned incorrect result");
        finishedTests++;
    })
        .finally(() => {
        assert.equal(finishedTests, 3, "Some tasks failed");
        assert.equal(q.stats().jobs.total, 0, "Queue has to be empty now");
    });
    // job is immediately picked up
    assert.equal(q.stats().jobs.total, 1);
    assert.equal(q.stats().jobs.inProgress, 1);
    // second worker must finish 0.1 sec after adding, first one should be still processing
    q.add(() => after(100, "two"))
        .then(result => {
        assert.equal(result, "two", "Task two returned incorrect result");
        assert.equal(finishedTests, 0, "Task two should finish first");
        finishedTests++;
    })
        .finally(() => {
        assert.equal(q.stats().jobs.total, 2, "Task two wasn't correctly removed");
        assert.equal(q.stats().jobs.inProgress, 2, "Task three wasn't immediately picked up");
    });
    assert.equal(q.stats().jobs.total, 2);
    assert.equal(q.stats().jobs.inProgress, 2);
    // the last worker must finish before the first one
    q.add(() => after(20, "three"))
        .then(result => {
        assert.equal(result, "three", "Task three returned incorrect result");
        assert.equal(finishedTests, 1, "Task three didn't finish second");
        finishedTests++;
    })
        .finally(() => {
        assert.equal(q.stats().jobs.total, 1, "Only first task is remaining");
        assert.equal(q.stats().jobs.inProgress, 1, "Only first task is in progress");
    });
    assert.equal(q.stats().jobs.total, 3, "Queue didn't accept all three tasks");
    assert.equal(q.stats().jobs.inProgress, 2, "Queue didn't start two concurrent jobs");
});
test("handles failed promise properly", assert => {
    assert.plan(3);
    let rejected = false;
    let resolved = false;
    const q = index_1.Queue();
    q.add(() => rejectAfter(100, "one"))
        .then(() => (resolved = true), rejectMsg => {
        assert.equal(rejectMsg, "one", "Rejection value is incorrect");
        rejected = true;
    })
        .finally(() => {
        assert.equal(resolved, false, "Queue resolved the promise");
        assert.equal(rejected, true, "Queue didn't handle promise rejection properly");
    });
});
test("handles errors in the promise", assert => {
    assert.plan(3);
    let rejected = false;
    let resolved = false;
    const q = index_1.Queue();
    q.add(() => {
        throw new Error("failed");
    })
        .then(() => (resolved = true), err => {
        assert.equal(err.message, "failed", "Error is not passed");
        rejected = true;
    })
        .finally(() => {
        assert.equal(resolved, false, "Promise was resolved when it shouldn't");
        assert.equal(rejected, true, "Promise wasn't rejected when it should");
    });
});
test("catches errors", assert => {
    assert.plan(3);
    let rejected = false;
    let resolved = false;
    const q = index_1.Queue();
    q.add(() => {
        throw new Error("failed");
    })
        .then(() => (resolved = true))
        .catch(err => {
        assert.equal(err.message, "failed", "Error is not passed");
        rejected = true;
    })
        .finally(() => {
        assert.equal(resolved, false, "Promise was resolved when it shouldn't");
        assert.equal(rejected, true, "Error didn't get into catch()");
    });
});
test("handles queue timeout", assert => {
    assert.plan(2);
    let gotTimeout = false;
    const q = index_1.Queue({
        queueTimeout: 10,
        executionTimeout: 1000,
        // this is a hack, concurrency 0 disables the queue which mean that queue
        // will not pick up jobs
        concurrency: 0,
        maxTaskCount: 1
    });
    q.add(() => after(100, "nah"))
        .then(() => {
        throw new Error("Task didn't timeout");
    }, err => {
        gotTimeout = true;
        assert.ok(err instanceof index_1.QueueTimeout, "It should fail with QueueTimeout error");
    })
        .finally(() => {
        assert.ok(gotTimeout, "It should fail with error");
    });
});
test("handles job timeout", assert => {
    assert.plan(2);
    let gotTimeout = false;
    const q = index_1.Queue({
        queueTimeout: 50,
        executionTimeout: 100,
        concurrency: 1,
        maxTaskCount: 1
    });
    q.add(() => after(200, "job_timeout"))
        .then(() => {
        throw new Error("Task didn't timeout");
    }, err => {
        gotTimeout = true;
        assert.ok(err instanceof index_1.JobTimeout, "It should fail with JobTimeout error");
    })
        .finally(() => {
        assert.ok(gotTimeout, "It should fail with error");
    });
});
test("handles job cancel when in queue state", assert => {
    assert.plan(8);
    let wasCancelled = true;
    let runningJobSuccesful = false;
    let waitingJobSuccesful = false;
    const q = index_1.Queue({
        queueTimeout: 250,
        executionTimeout: 250,
        concurrency: 1,
        maxTaskCount: 5
    });
    q.add(() => after(50, "running")).then(value => {
        assert.equal(value, "running");
        runningJobSuccesful = true;
    });
    q.add(() => after(50, "waiting"))
        .then(value => {
        assert.equal(value, "waiting");
        waitingJobSuccesful = true;
    })
        .finally(() => {
        assert.ok(wasCancelled, "Job should be canceled");
        assert.ok(runningJobSuccesful, "Running job should success");
        assert.ok(waitingJobSuccesful, "Waiting job should success");
    });
    const promise = q.add(() => after(10, "cancel"));
    promise.then(() => {
        throw new Error("failed");
    }, err => {
        assert.ok(err instanceof index_1.JobCancelled, "Job should fail with cancel error");
        wasCancelled = true;
        assert.equal(q.stats().jobs.inProgress, 1, "Only one job is processing");
        assert.equal(q.stats().jobs.waiting, 1, "Only one job is waiting");
    });
    setTimeout(() => {
        promise.cancel();
    }, 1);
});
test("handles job cancel when in processing state", assert => {
    assert.plan(3);
    let wasCancelled = true;
    const q = index_1.Queue({
        queueTimeout: 250,
        executionTimeout: 250,
        concurrency: 2,
        maxTaskCount: 2
    });
    q.add(() => after(100, "running"))
        .then(value => {
        assert.equal(value, "running");
    })
        .finally(() => {
        assert.ok(wasCancelled, "Job should be cancelled");
    });
    const promise = q.add(() => after(50, "cancel"));
    promise.then(() => {
        throw new Error("Job shouldn't succeed as it was cancelled");
    }, err => {
        wasCancelled = true;
        assert.ok(err instanceof index_1.JobCancelled, "Job should fail with cancel error");
    });
    setTimeout(() => {
        promise.cancel();
    }, 1);
});
test("cancel does nothing when unknown job done", assert => {
    assert.plan(1);
    let finished = 0;
    const q = index_1.Queue({
        queueTimeout: 50,
        executionTimeout: 100,
        concurrency: 1,
        maxTaskCount: 5
    });
    const promise = q.add(() => after(10, "first"));
    promise
        .then(() => {
        finished++;
        return q.add(() => after(10, "second"));
    })
        .then(() => {
        finished++;
        promise.cancel();
        return q.add(() => after(10, "third"));
    })
        .then(() => {
        finished++;
        assert.equal(finished, 3, "3 jobs has to be processed");
    })
        .catch(_e => {
        throw new Error("All jobs have to success");
    });
});
test("new jobs start after a job timeout", assert => {
    assert.plan(5);
    const q = index_1.Queue({
        queueTimeout: 5000,
        executionTimeout: 50,
        concurrency: 5,
        maxTaskCount: 10
    });
    q.add(() => after(40, true)).then(() => {
        const stats = q.stats();
        assert.equal(stats.jobs.total, 9);
        assert.equal(stats.jobs.inProgress, 5);
    });
    q.add(() => after(40, true)).then(() => {
        const stats = q.stats();
        assert.equal(stats.jobs.total, 8);
        assert.equal(stats.jobs.inProgress, 5);
    });
    q.add(doNothing)
        .catch(() => true)
        .finally(() => {
        const stats = q.stats();
        assert.equal(stats.jobs.inProgress, 5, `There should be 5 jobs in progress, because there are ${stats.jobs.waiting} jobs waiting`);
    });
    q.add(() => after(40, true));
    q.add(() => after(40, true));
    q.add(() => after(40, true));
    q.add(() => after(40, true));
    q.add(() => after(40, true));
    q.add(() => after(40, true));
    q.add(() => after(40, true));
});
function after(ms, value) {
    return new Promise(res => setTimeout(() => res(value), ms));
}
function rejectAfter(ms, err) {
    return new Promise((_res, rej) => setTimeout(() => rej(err), ms));
}
function doNothing() {
    return new Promise(() => { });
}
//# sourceMappingURL=index.test.js.map