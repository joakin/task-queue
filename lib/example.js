"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const queue = index_1.Queue();
queue.add(hardToDoComputation);
queue.add(hardToDoComputation);
queue.add(hardToDoComputation);
queue.add(hardToDoComputation);
function hardToDoComputation() {
    return Promise.resolve(500);
}
//# sourceMappingURL=example.js.map