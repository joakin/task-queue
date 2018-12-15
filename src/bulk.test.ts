import {
  Queue,
  JobTimeout,
  QueueFull,
  QueueTimeout,
  JobCancelled
} from "./index";

import * as test from "tape";

const tasks = 1000;
const maxTaskDuration = 1000;
const concurrency = 40;
const fails = 0.3;
const successes = 0.6;
const timeouts = 0.1;

function makeJob(): { job: () => Promise<string>; cancel: () => void } {
  let timeout: NodeJS.Timeout;
  return {
    job() {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const r = Math.random();
          if (r < fails) {
            reject(new Error("Failure"));
          } else if (r < fails + successes) {
            resolve("Success");
          } else {
            /* NOOP for timeout */
          }
        }, Math.random() * maxTaskDuration);
      });
    },
    cancel() {
      timeout && clearTimeout(timeout);
    }
  };
}

test("Bulk test", assert => {
  const queue = Queue({
    maxTaskCount: tasks,
    concurrency: concurrency,
    executionTimeout: maxTaskDuration,
    queueTimeout: tasks * maxTaskDuration
  });
  const stats = {
    success: 0,
    fail: 0,
    timeout: 0,
    other: 0,
    queuetimeout: 0,
    queuefull: 0,
    cancelled: 0
  };

  const promises = Array(tasks)
    .fill(null)
    .map((_, i) => {
      const { job, cancel } = makeJob();
      const promise = queue
        .add(job, cancel)
        .then(
          _result => {
            stats.success++;
            console.log(i, "success");
          },
          (err: Error) => {
            if (err instanceof QueueTimeout) {
              stats.queuetimeout++;
              console.log(i, "queuetimeout");
            } else if (err instanceof QueueFull) {
              stats.queuefull++;
              console.log(i, "queuefull");
            } else if (err instanceof JobCancelled) {
              console.log(i, "jobcancelled");
              stats.cancelled++;
            } else if (err instanceof JobTimeout) {
              stats.timeout++;
              console.log(i, "jobtimeout");
            } else if (err.message === "Failure") {
              stats.fail++;
              console.log(i, "failure");
            } else {
              // Something else failed when running the job function
              stats.other++;
              console.log(i, "somethingelse");
            }
          }
        )
        .finally(() => {
          console.log(queue.stats());
          return Promise.resolve();
        });

      return promise;
    });

  assert.plan(4);
  Promise.all(promises).finally(() => {
    console.log("success: ", (stats.success * 100) / tasks, "%");
    console.log("fail: ", (stats.fail * 100) / tasks, "%");
    console.log("timeout: ", (stats.timeout * 100) / tasks, "%");
    console.log("other: ", (stats.other * 100) / tasks, "%");
    console.log("queuetimeout: ", (stats.queuetimeout * 100) / tasks, "%");
    console.log("queuefull: ", (stats.queuefull * 100) / tasks, "%");
    console.log("cancelled: ", (stats.cancelled * 100) / tasks, "%");

    assert.ok(
      close(fails + successes + timeouts, 1),
      `fails ${fails} successes ${successes} and timeouts ${timeouts} must add to 1`
    );
    assert.ok(
      close(stats.success / tasks, successes),
      `successes ${stats.success / tasks} must be close to ${successes}`
    );
    assert.ok(
      close(stats.fail / tasks, fails),
      `fails ${stats.fail / tasks} must be close to ${fails}`
    );
    assert.ok(
      close(stats.timeout / tasks, timeouts),
      `timeouts ${stats.timeout / tasks} must be close to ${timeouts}`
    );
  });
});

function close(n1: number, n2: number) {
  return Math.abs(n1 - n2) < 0.05;
}
