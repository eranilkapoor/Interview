# Linked Lists

A linked list stores elements as individual nodes scattered anywhere in memory, where each node holds a value plus a reference (pointer) to the next node in the sequence. There is no contiguity requirement and no random-access address arithmetic — to reach the k-th element you must start at the head and follow `next` pointers k times, making arbitrary access O(n). What you gain in exchange is O(1) insertion and deletion *at a known position* (given a reference to the node before it): you just rewire a couple of pointers, with no shifting of other elements, unlike an array where inserting in the middle means moving everything after it.

There are three common variants. A **singly linked list** has nodes with a single `next` pointer, so traversal is one-directional (head to tail only) and deleting a node requires a reference to its *predecessor* (since you can't walk backward to find it). A **doubly linked list** adds a `prev` pointer to each node, enabling backward traversal and O(1) deletion given only a reference to the node itself (no predecessor lookup needed) — at the cost of extra memory per node and more pointer bookkeeping on every insert/delete. A **circular linked list** has the tail's `next` (and, if doubly linked, the head's `prev`) point back to the head instead of to `null`, which is useful for round-robin scheduling, circular buffers, or repeatedly cycling through a fixed set of items without special-casing the wraparound.

The core tradeoff versus arrays is access pattern vs. mutation pattern: arrays excel when you need random access or cache-friendly sequential scans; linked lists excel when you need frequent insertion/deletion at arbitrary (but known) positions without the cost of shifting elements — think of an LRU cache's usage-order list, or undo history where nodes are spliced out constantly. Linked lists also have per-node memory overhead (the pointer(s) themselves) and worse cache locality than arrays, since consecutive nodes are typically not adjacent in memory — so even an O(n) linked-list scan is usually slower in practice than an O(n) array scan.

Two classic algorithmic techniques are strongly associated with linked lists specifically because they exploit the pointer structure: **in-place reversal**, which rewires every node's `next` pointer to point backward instead of forward using three tracked pointers (`prev`, `current`, `next`), and **Floyd's cycle detection** (tortoise and hare), which uses two pointers moving at different speeds to detect a cycle in O(n) time and O(1) space — something that would otherwise require O(n) auxiliary space (a visited-node set) to detect.

## Examples

```js
// Singly linked list with insert, delete, and traverse
class ListNode {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class SinglyLinkedList {
  constructor() {
    this.head = null;
    this.size = 0;
  }

  insertAtHead(value) {
    const node = new ListNode(value);
    node.next = this.head;
    this.head = node; // O(1) — no shifting, unlike array unshift
    this.size++;
  }

  insertAtTail(value) {
    const node = new ListNode(value);
    if (!this.head) { this.head = node; this.size++; return; }
    let current = this.head;
    while (current.next) current = current.next; // O(n) to find the tail
    current.next = node;
    this.size++;
  }

  deleteValue(value) {
    if (!this.head) return false;
    if (this.head.value === value) { this.head = this.head.next; this.size--; return true; }
    let prev = this.head;
    while (prev.next && prev.next.value !== value) prev = prev.next; // O(n) search
    if (!prev.next) return false; // not found
    prev.next = prev.next.next; // O(1) unlink once the predecessor is known
    this.size--;
    return true;
  }

  toArray() {
    const out = [];
    let current = this.head;
    while (current) { out.push(current.value); current = current.next; } // O(n) traversal
    return out;
  }
}

const list = new SinglyLinkedList();
list.insertAtTail(1);
list.insertAtTail(2);
list.insertAtHead(0);
list.deleteValue(1);
console.log(list.toArray()); // [0, 2]
```
Time: `insertAtHead` O(1); `insertAtTail`/`deleteValue`/`toArray` O(n) due to the search or traversal (a tail pointer would make `insertAtTail` O(1)). Space: O(n) for n nodes, plus one pointer per node.

```js
// Reverse a singly linked list in place — classic interview question
function reverseList(head) {
  let prev = null;
  let current = head;
  while (current !== null) {
    const next = current.next; // save the forward link before overwriting it
    current.next = prev;       // reverse the pointer
    prev = current;            // advance prev
    current = next;            // advance current using the saved reference
  }
  return prev; // prev is the new head
}

// Build 1 -> 2 -> 3 -> null, reverse it to 3 -> 2 -> 1 -> null
let head = new ListNode(1);
head.next = new ListNode(2);
head.next.next = new ListNode(3);
const reversed = reverseList(head);
const out = [];
for (let n = reversed; n; n = n.next) out.push(n.value);
console.log(out); // [3, 2, 1]
```
Time: O(n) — visits each node exactly once. Space: O(1) — only three pointers used, no new nodes or arrays allocated (reversal happens by rewiring existing nodes).

```js
// Floyd's cycle detection (tortoise and hare) — detect a cycle in O(1) space
function hasCycle(head) {
  let slow = head;
  let fast = head;
  while (fast !== null && fast.next !== null) {
    slow = slow.next;       // moves 1 step
    fast = fast.next.next;  // moves 2 steps
    if (slow === fast) return true; // they meet only if there's a cycle
  }
  return false; // fast hit the end, so the list is acyclic
}

const a = new ListNode('a');
const b = new ListNode('b');
const c = new ListNode('c');
a.next = b; b.next = c; c.next = a; // cycle: a -> b -> c -> a
console.log(hasCycle(a)); // true

const d = new ListNode('d');
d.next = new ListNode('e');
console.log(hasCycle(d)); // false
```
Time: O(n) — if a cycle exists, the fast pointer gains one node on the slow pointer per step, so they meet within at most n iterations; if not, fast reaches `null` within n/2 iterations. Space: O(1) — only two pointers, no visited-set needed.

## Common Pitfalls / Gotchas

- Losing the reference to the rest of the list when reversing: overwriting `current.next` before saving it in a temporary variable orphans the remainder of the list — always capture `next` *before* rewiring.
- Forgetting to update `head` after operations that might change it (e.g., deleting the first node, or reversing) — code that assumes the original `head` variable is still valid will silently traverse a stale or wrong list.
- Off-by-one/null errors at list boundaries: not checking `head === null` (empty list) or `head.next === null` (single node) before dereferencing `.next.next`, which throws or infinite-loops on edge cases.
- Assuming singly linked list deletion is O(1) in general — it's O(1) only once you already have a pointer to the *predecessor* node; finding that predecessor by value is O(n). A doubly linked list avoids this by storing `prev` directly on each node.
- Creating an accidental cycle by wiring a node's `next` back to an earlier node (common bug when manually rewiring pointers during in-place algorithms), which then causes an infinite loop in any naive traversal.

## Interview Questions & Answers

**Q: Reverse a singly linked list in place. What are the time and space complexities?**
A: Walk the list with three pointers — `prev` (initially `null`), `current` (initially `head`), and a temporary `next`. At each node, save `current.next`, point `current.next` back to `prev`, then advance `prev` and `current` forward. When `current` becomes `null`, `prev` is the new head. This is O(n) time (one pass, one pointer rewire per node) and O(1) space since no new nodes or arrays are allocated — only existing pointers are rewired.

**Q: How do you detect whether a linked list has a cycle, without using extra memory proportional to the list size?**
A: Floyd's cycle detection algorithm (tortoise and hare): use two pointers, `slow` advancing one node per step and `fast` advancing two nodes per step. If there's no cycle, `fast` reaches `null` and the loop terminates normally. If there is a cycle, `fast` will eventually lap `slow` inside the cycle and they become equal — a mathematical consequence of `fast` closing the gap by one node per iteration once both are inside the loop. This runs in O(n) time and O(1) space, versus the O(n) space a hash-set-of-visited-nodes approach would need.

**Q: Why is arbitrary-index access O(n) in a linked list but O(1) in an array?**
A: Array elements are contiguous and same-sized, so any index maps to an address via direct arithmetic. Linked list nodes can live anywhere in memory and are connected only by pointers, so there is no formula to jump to the k-th node — the only way to get there is to start at the head and follow `next` links k times, which is inherently O(n).

**Q: What's the tradeoff between a singly linked list and a doubly linked list?**
A: A doubly linked list stores a `prev` pointer in addition to `next`, enabling backward traversal and O(1) deletion given just a reference to the node itself (no need to separately locate its predecessor). This comes at the cost of extra memory (one more pointer per node) and more pointer updates on every insert/delete (both `next` and `prev` links on up to three nodes must be kept consistent), which also means more opportunities for pointer bugs.

**Q: When would you choose a linked list over a dynamic array, and vice versa?**
A: Choose a linked list when you need frequent insertions/deletions at arbitrary but known positions (e.g., splicing nodes out of an LRU cache's usage order) and don't need random access or must avoid the O(n) shifting cost of array insert/delete. Choose a dynamic array when you need O(1) random access, better cache locality for sequential scans, and lower per-element memory overhead (no pointer storage) — which is why arrays are the default choice unless the workload is dominated by positional insert/delete.

## Related Topics

- [arrays.md](./arrays.md)
- [stacks.md](./stacks.md)
- [queues.md](./queues.md)
- [recursion.md](./recursion.md)
- [time-complexity.md](./time-complexity.md)
- [space-complexity.md](./space-complexity.md)
