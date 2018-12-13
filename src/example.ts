import { Queue } from "./index";

const queue = Queue();

queue.add(hardToDoComputation);
queue.add(hardToDoComputation);
queue.add(hardToDoComputation);
queue.add(hardToDoComputation);

function hardToDoComputation() {
  return Promise.resolve(500);
}
