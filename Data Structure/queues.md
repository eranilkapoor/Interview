# Queues

A queue is a linear data structure that enforces **FIFO** ordering — First In, First Out: elements are added at the **back** (`enqueue`) and removed from the **front** (`dequeue`), so the first element added is always the first one removed. This is the exact mirror of a stack's LIFO discipline (see [stacks.md](./stacks.md)) — a queue models a line of people waiting, where the person who arrived first gets served first, while a stack models a pile where you can only take from the top.

The implementation choice matters a lot in practice. A **JavaScript array** used naively as a queue (`push` to enqueue, `shift` to dequeue) has an O(1) `push` but an O(n) `shift`, because removing the first element requires re-indexing every remaining element down by one — a common interview trap, since it "looks" O(1) but isn't. A **linked list** with tracked `head` and `tail` pointers gives genuine O(1) enqueue and dequeue, since adding to the tail or removing from the head never requires touching any other node. A **circular queue** (also called a ring buffer) uses a single fixed-size array with wraparound index arithmetic (`(front + count) % capacity`), giving O(1) operations without any per-node pointer overhead — ideal when a maximum size is known ahead of time, as in producer-consumer buffers or streaming pipelines.

Queues are the structural backbone of **BFS** (breadth-first traversal processes nodes in the order they were discovered — a queue's FIFO order does exactly this, guaranteeing shortest-path-in-hops correctness), task scheduling (process jobs in arrival order), and any producer-consumer pipeline (one part of a system enqueues work, another dequeues and processes it). Where a problem calls for "process oldest/first-arrived work first," reach for a queue; where it calls for "undo the most recent action" or "process most-recently-seen first," reach for a stack.

## Examples

```js
// Array-based queue — simple, but dequeue() is O(n) because shift() re-indexes
// every remaining element. Fine for small queues; a real hot path should avoid this.
class ArrayQueue {
  constructor() { this.items = []; }
  enqueue(item) { this.items.push(item); }        // O(1) amortized
  dequeue() { return this.items.shift(); }         // O(n) — the common misconception is that this is O(1)
  peek() { return this.items[0]; }
  isEmpty() { return this.items.length === 0; }
  size() { return this.items.length; }
}
```

```js
// Linked-list-based queue — true O(1) enqueue and dequeue via tracked head/tail.
class ListNode {
  constructor(value) { this.value = value; this.next = null; }
}

class LinkedQueue {
  constructor() { this.head = null; this.tail = null; this._size = 0; }

  enqueue(value) {
    const node = new ListNode(value);
    if (this.tail) this.tail.next = node;
    else this.head = node;      // queue was empty — new node is both head and tail
    this.tail = node;
    this._size++;
  }

  dequeue() {
    if (!this.head) return undefined;
    const value = this.head.value;
    this.head = this.head.next;
    if (!this.head) this.tail = null; // queue became empty — reset tail too, or it dangles
    this._size--;
    return value;
  }

  peek() { return this.head ? this.head.value : undefined; }
  isEmpty() { return this._size === 0; }
  size() { return this._size; }
}
```

```js
// Circular queue (ring buffer) — fixed-capacity array with wraparound indices.
// O(1) enqueue/dequeue with no per-node allocation, ideal for bounded buffers.
class CircularQueue {
  constructor(capacity) {
    this.capacity = capacity;
    this.items = new Array(capacity);
    this.front = 0;
    this.count = 0;
  }

  enqueue(value) {
    if (this.count === this.capacity) throw new Error('Queue is full');
    const index = (this.front + this.count) % this.capacity; // wrap around the end
    this.items[index] = value;
    this.count++;
  }

  dequeue() {
    if (this.count === 0) return undefined;
    const value = this.items[this.front];
    this.front = (this.front + 1) % this.capacity; // advance front, wrapping if needed
    this.count--;
    return value;
  }

  isFull() { return this.count === this.capacity; }
  isEmpty() { return this.count === 0; }
}

const cq = new CircularQueue(3);
cq.enqueue('a'); cq.enqueue('b'); cq.enqueue('c'); // full
cq.dequeue();                                       // 'a' — front advances to index 1
cq.enqueue('d');                                    // wraps around and fills index 0
```

## Common Pitfalls / Gotchas

- Assuming `Array.prototype.shift()` is O(1) — it's O(n), since every remaining element must shift down one index; using an array queue with frequent dequeues on a large dataset is a real performance bug, not just a theoretical one.
- Forgetting to reset `tail` to `null` when a linked-list queue's last element is dequeued — leaving a stale `tail` reference causes the next `enqueue` to silently corrupt the structure (attaching a new node to a "tail" that's no longer reachable from `head`).
- Off-by-one errors in circular queue index math — `(front + count) % capacity` for the next write position, and remembering to track `count` separately (or reserve one slot) to distinguish a full queue from an empty one, since `front === rear` alone is ambiguous between the two.
- Confusing queue (FIFO) with stack (LIFO) when picking a structure for BFS vs DFS — using a stack where BFS is needed silently turns the traversal into something DFS-like, breaking the shortest-path guarantee.
- Enqueuing/dequeuing in a circular queue without checking `isFull()`/`isEmpty()` first, silently overwriting unread data or returning stale/incorrect values.

## Interview Questions & Answers

**Q: Why is `Array.shift()` a poor choice for a queue's dequeue operation at scale?**
A: `shift()` removes the first element and then has to re-index every other element in the array down by one position, making it O(n) per call. A queue used in a hot path (e.g., BFS over a large graph) with an array-backed `shift()`-based dequeue silently becomes O(n) per operation, turning an expected O(V + E) BFS into O(V²) — a subtle but real performance bug.

**Q: How do you get true O(1) enqueue and dequeue in JavaScript?**
A: Use a linked-list-based queue with tracked `head` and `tail` pointers — enqueue attaches a new node to `tail` and updates it, dequeue removes from `head` and advances it, neither touching any other node. Alternatively, for a bounded/known-capacity use case, a circular buffer (fixed array with modular index arithmetic) achieves O(1) without any node allocation at all.

**Q: What's the benefit of a circular queue over a plain array or linked-list queue?**
A: It reuses a single fixed-size array in place — no dynamic node allocation (unlike a linked list) and no O(n) re-indexing (unlike array `shift()`) — by wrapping the read/write index around with modulo arithmetic. This makes it ideal for bounded, high-throughput scenarios like producer-consumer buffers, I/O buffering, or streaming pipelines where the maximum size is known upfront.

**Q: How would you implement a queue using two stacks — and why would you?**
A: Keep an "in" stack for enqueues (push directly) and an "out" stack for dequeues. To dequeue, if "out" is empty, pop everything off "in" and push it onto "out" (this reverses the order, turning stack LIFO into queue FIFO), then pop from "out"; if "out" already has elements, just pop from it directly. Each element moves from "in" to "out" at most once, so the amortized cost per operation is still O(1) even though a single dequeue can occasionally be O(n). It's a classic interview question testing whether you understand how LIFO and FIFO relate structurally.

**Q: Give a real use case where a queue is the natural structure, and contrast it with where a stack would be wrong.**
A: BFS graph traversal must use a queue: processing nodes in *discovery order* (FIFO) is what guarantees the shortest-hop-count path is found first in an unweighted graph. Using a stack there instead would turn the traversal into something DFS-like — it would still visit every node, but would go deep down one branch before exploring siblings, losing the shortest-path guarantee entirely. Conversely, "undo" functionality is naturally a stack (most recent action undone first, LIFO) — a queue would undo actions in the wrong order (oldest first).

## Related Topics

- [stacks.md](./stacks.md)
- [linked-lists.md](./linked-lists.md)
- [arrays.md](./arrays.md)
- [graphs.md](./graphs.md)
- [big-o-notation.md](./big-o-notation.md)
</content>
</invoke>
