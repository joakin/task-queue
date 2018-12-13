# task-queue

`npm install task-queue`

A customizable job/task queue for javascript processes.

```js
import { Queue } from "@joakin/task-queue";

const queue = Queue();

queue.add(hardToDoComputation);
queue.add(hardToDoComputation);
queue.add(hardToDoComputation);
queue.add(hardToDoComputation);
```

## TODO

- Write README and docs
- Review event names and payload
- Review multiple calls to `cleanup` to see if we can remove them
- Add tests for QueueFull
- Rename errors to not have Queue on their name
