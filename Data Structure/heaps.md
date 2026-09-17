# Heaps

A heap is a complete binary tree that satisfies the **heap property**: in a min-heap, every parent is less than or equal to both its children (so the smallest element is always at the root); a max-heap inverts this (largest at the root). "Complete" means every level is fully filled except possibly the last, which fills left to right with no gaps — this specific shape is what allows a heap to be stored efficiently in a plain array with no pointers at all: for a node at index `i`, its parent is at `Math.floor((i-1)/2)`, its left child at `2i+1`, and its right child at `2i+2`. Note that a heap is *not* a sorted structure and is *not* a BST — it only guarantees each parent beats its children, with no ordering promise between siblings or across subtrees.

The two operations that maintain the heap property are **sift-up** (bubble up) and **sift-down** (bubble down). Inserting a new element appends it at the end of the array (the next open leaf position, preserving completeness) and then sifts it up — repeatedly swapping with its parent as long as it violates the heap property — in O(log n) since it can travel at most the tree's height. Extracting the root (the min or max) removes it, moves the *last* element into the root position (again preserving completeness), and sifts that element down — repeatedly swapping with its smaller (or larger) child — also O(log n). Peeking at the root is O(1) since it's always at index 0.

Heaps are the standard backing structure for a **priority queue** (elements come out in priority order rather than insertion order), which shows up throughout algorithms — Dijkstra's shortest path, Prim's MST, task schedulers, and the "kth largest element" family of problems. Building a heap from an unsorted array of n elements can be done in O(n) (not O(n log n)) by calling sift-down on every non-leaf node from the bottom up — the **heapify** operation — which is a classic and often-missed complexity gotcha. **Heap sort** repeatedly extracts the max from a max-heap into the end of the array, giving O(n log n) time and O(1) extra space (in-place), but it is *not stable*, since equal elements can be reordered by the sift operations.

## Examples

```js
// Min-heap with array-based storage: sift-up on insert, sift-down on extractMin.
class MinHeap {
  constructor() { this.heap = []; }

  size() { return this.heap.length; }
  peek() { return this.heap[0]; }

  _parent(i) { return Math.floor((i - 1) / 2); }
  _left(i) { return 2 * i + 1; }
  _right(i) { return 2 * i + 2; }
  _swap(i, j) { [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]]; }

  insert(value) {
    this.heap.push(value);           // append at the next leaf position (keeps it complete)
    this._siftUp(this.heap.length - 1);
  }

  _siftUp(i) {
    while (i > 0 && this.heap[this._parent(i)] > this.heap[i]) {
      this._swap(i, this._parent(i));
      i = this._parent(i);
    }
  }

  extractMin() {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop();     // remove the last leaf
    if (this.heap.length > 0) {
      this.heap[0] = last;            // move it to the root (keeps completeness)
      this._siftDown(0);
    }
    return min;
  }

  _siftDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = this._left(i), r = this._right(i);
      if (l < n && this.heap[l] < this.heap[smallest]) smallest = l;
      if (r < n && this.heap[r] < this.heap[smallest]) smallest = r;
      if (smallest === i) break;      // heap property satisfied — stop
      this._swap(i, smallest);
      i = smallest;
    }
  }

  static heapify(array) {
    const h = new MinHeap();
    h.heap = [...array];
    // start from the last non-leaf node and sift down — this is what makes
    // heapify O(n) instead of O(n log n) (inserting one by one would be O(n log n))
    for (let i = Math.floor(h.heap.length / 2) - 1; i >= 0; i--) {
      h._siftDown(i);
    }
    return h;
  }
}

const heap = MinHeap.heapify([9, 4, 7, 1, 5, 3]);
heap.peek();       // 1
heap.extractMin(); // 1
heap.extractMin(); // 3
```

```js
// Heap sort: repeatedly extract the min into a result array. O(n log n) time,
// O(n) here because we build a new array — a true in-place version sorts within
// the same backing array using a max-heap and swapping the root to the end.
function heapSort(array) {
  const heap = MinHeap.heapify(array);
  const sorted = [];
  while (heap.size() > 0) sorted.push(heap.extractMin());
  return sorted;
}

heapSort([5, 2, 8, 1, 9, 3]); // [1, 2, 3, 5, 8, 9]
```

```js
// Priority queue usage: process tasks by priority (lower number = higher priority)
// rather than insertion order — exactly what a min-heap is built for.
const taskQueue = new MinHeap();
taskQueue.insert({ priority: 3, task: 'send email' });
// MinHeap as written compares raw values, so for objects you'd compare on .priority;
// shown conceptually — a real implementation parameterizes the comparator.
```

## Common Pitfalls / Gotchas

- Confusing a heap with a sorted array or a BST — a heap only guarantees parent-vs-children ordering, not sibling ordering or full sortedness; `heap[1]` and `heap[2]` (the two children of the root) have no defined order relative to each other.
- Getting the parent/child index formulas wrong — for 0-indexed arrays, parent is `Math.floor((i-1)/2)`, children are `2i+1` and `2i+2`; mixing up 0-indexed and 1-indexed formulas is a very common source of bugs.
- Forgetting that `heapify` (building a heap from an existing array) is O(n), not O(n log n) — the naive assumption ("n inserts, each O(log n), so O(n log n)") is wrong because most nodes being sifted down are near the bottom of the tree and travel only a short distance; the correct sum across all levels bounds to O(n).
- After extracting the root, forgetting to move the *last* element into the root position before sifting down (or sifting down from the wrong index) — this breaks the completeness invariant the array representation depends on.
- Assuming heap sort is stable — it isn't; sift operations can reorder equal elements relative to each other, unlike merge sort.

## Interview Questions & Answers

**Q: Why is a heap typically implemented as an array instead of a tree with pointers?**
A: A heap's "complete binary tree" shape guarantees there are no gaps in the array representation — level order fills left to right — so parent/child relationships can be computed purely from index arithmetic (`parent = floor((i-1)/2)`, children = `2i+1`, `2i+2`) with no pointer storage needed. This is more memory-efficient (no per-node pointer overhead) and has better cache locality than a pointer-based tree.

**Q: What's the time complexity of insert, extractMin/Max, and peek, and why?**
A: Insert and extract are both O(log n): insert appends then sifts up, extract replaces the root with the last element and sifts down — both operations can travel at most the height of the tree, which is O(log n) for a complete binary tree with n nodes. Peek is O(1) because the min (or max) is always at index 0 by the heap property.

**Q: Why is building a heap from n elements (heapify) O(n) rather than O(n log n)?**
A: Calling sift-down on every non-leaf node bottom-up does more work on nodes near the root (where sift-down can travel further) but those are few, while the many nodes near the leaves do very little work (they're already close to where they'd end up). Summing sift-down cost across all levels gives a series that converges to O(n) total, not O(n log n) — a well-known but frequently mis-stated complexity result.

**Q: How would you find the kth largest element in an array using a heap, and what's the complexity?**
A: Maintain a min-heap of size k: push the first k elements, then for every remaining element, push it and if the heap now exceeds size k, extract the min. After processing all n elements, the heap's root is the kth largest. This is O(n log k) — better than sorting (O(n log n)) when k is small relative to n.

**Q: Why is heap sort not stable, and how does that compare to merge sort?**
A: Heap sort repeatedly swaps the root with elements deep in the tree during sift-down, and those swaps can reorder two equal elements relative to their original positions with no mechanism to preserve original order. Merge sort, by contrast, is stable because its merge step explicitly takes from the left half first on ties. Heap sort's tradeoff is O(1) extra space (in-place) versus merge sort's O(n); pick heap sort when memory is tight and stability doesn't matter, merge sort when stability is required.

## Related Topics

- [trees.md](./trees.md)
- [binary-search-trees.md](./binary-search-trees.md)
- [sorting-algorithms.md](./sorting-algorithms.md)
- [big-o-notation.md](./big-o-notation.md)
- [minimum-spanning-tree.md](./minimum-spanning-tree.md)
</content>
</invoke>
