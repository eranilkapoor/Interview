# Arrays

An array is a contiguous block of memory holding elements of a fixed-size type, indexed by an integer offset. Because the elements sit next to each other in memory and each element has the same size, the address of any element can be computed directly with arithmetic — `address = base_address + index * element_size` — which is exactly why array indexing is O(1): there's no traversal involved, just a multiplication and an addition. This contiguity is also what makes arrays cache-friendly: iterating an array sequentially tends to pull consecutive memory into the CPU cache line together, giving arrays much better real-world performance than pointer-chasing structures like linked lists even when both are "O(n)" for a scan.

JavaScript arrays are not raw fixed-size C-style arrays; engines like V8 implement them as dynamic arrays (growable, with some elements potentially stored as a hash map "dictionary mode" if the array becomes sparse or has non-index properties). But the *conceptual* model interviewers care about is the classic dynamic array: a fixed-capacity backing buffer that is reallocated and doubled in size when it fills up. Static arrays (fixed capacity, common in C/Java's `int[]`) require you to know the size up front and can't grow. Dynamic arrays (JS `Array`, Python `list`, Java `ArrayList`, C++ `std::vector`) simulate growable arrays on top of a static buffer: when a push would exceed capacity, a new buffer of (typically) double the size is allocated, and every existing element is copied over — an O(n) operation — before the new element is appended.

That resize is the key to understanding **amortized O(1) push**. A single push that triggers a resize costs O(n). But because capacity doubles each time, resizes become exponentially rarer as the array grows: resizes happen at sizes 1, 2, 4, 8, 16, ... So across n pushes, the total copying work is 1 + 2 + 4 + ... + n ≈ 2n, which spread evenly across n operations gives O(1) *amortized* per push — even though any individual push might occasionally cost O(n). This is different from *every* push being O(1); it's a statement about the average cost over a long sequence of operations, formally proven via the "accounting method" or "potential method" in amortized analysis.

Insertion or deletion at an arbitrary index (not the end) is O(n) in both static and dynamic arrays, because every element after the insertion/deletion point must be shifted one slot to preserve contiguity — `splice` in JS does exactly this shifting internally. This is the fundamental tradeoff against linked lists: arrays give O(1) random access but O(n) arbitrary insert/delete; linked lists give O(1) insert/delete at a known node but O(n) access (no random indexing, must walk from the head). Choosing between them is a direct function of which operation dominates your workload.

## Examples

```js
// Manual dynamic-array-style growth: doubling capacity, amortized O(1) push
class DynamicArray {
  constructor() {
    this._capacity = 2;
    this._length = 0;
    this._buffer = new Array(this._capacity);
  }

  get length() {
    return this._length;
  }

  push(value) {
    if (this._length === this._capacity) {
      this._resize(this._capacity * 2); // O(n) — happens exponentially rarely
    }
    this._buffer[this._length] = value;
    this._length++; // O(1) amortized overall
  }

  _resize(newCapacity) {
    const newBuffer = new Array(newCapacity);
    for (let i = 0; i < this._length; i++) newBuffer[i] = this._buffer[i]; // O(n) copy
    this._buffer = newBuffer;
    this._capacity = newCapacity;
  }

  get(index) {
    if (index < 0 || index >= this._length) throw new RangeError('Index out of bounds');
    return this._buffer[index]; // O(1) — direct address arithmetic
  }
}

const arr = new DynamicArray();
for (let i = 0; i < 5; i++) arr.push(i * 10);
console.log(arr.get(3)); // 30
```
Time: `get` is O(1); `push` is amortized O(1), worst case O(n) on a resizing call. Space: O(n) for n elements, with up to ~2x overallocation right after a resize.

```js
// Two-pointer technique: remove duplicates from a sorted array in place
function removeDuplicatesSorted(nums) {
  if (nums.length === 0) return 0;
  let writePointer = 1; // slot where the next unique value should be written
  for (let readPointer = 1; readPointer < nums.length; readPointer++) {
    if (nums[readPointer] !== nums[writePointer - 1]) {
      nums[writePointer] = nums[readPointer];
      writePointer++;
    }
  }
  return writePointer; // new logical length; nums[0..writePointer) is deduplicated
}

const sorted = [1, 1, 2, 2, 2, 3, 4, 4];
const newLength = removeDuplicatesSorted(sorted);
console.log(sorted.slice(0, newLength)); // [1, 2, 3, 4]
```
Time: O(n) — each pointer traverses the array once. Space: O(1) — mutated in place, no auxiliary array.

```js
// In-place array reversal using two pointers moving toward each other
function reverseInPlace(arr) {
  let left = 0;
  let right = arr.length - 1;
  while (left < right) {
    [arr[left], arr[right]] = [arr[right], arr[left]]; // swap without a temp array
    left++;
    right--;
  }
  return arr;
}

console.log(reverseInPlace([1, 2, 3, 4, 5])); // [5, 4, 3, 2, 1]
```
Time: O(n) — visits roughly n/2 pairs. Space: O(1) — no new array allocated, only swaps.

## Common Pitfalls / Gotchas

- Assuming `array.push()` is always strictly O(1) — it's amortized O(1); a resizing push is O(n), which matters if you're reasoning about worst-case latency (e.g., real-time systems) rather than average throughput.
- Using `array.shift()` or `array.unshift()` in a hot loop without realizing they're O(n) — every remaining element has to be shifted to close or open a gap at index 0, unlike `push`/`pop` at the tail which are O(1).
- Off-by-one errors in two-pointer or sliding-window code — getting `<` vs `<=` wrong on the loop condition, or forgetting that `slice(start, end)` excludes `end`, is one of the most common sources of interview bugs.
- Treating `array.length` as the buffer's true capacity — in a hand-rolled dynamic array, `length` (logical size) and `capacity` (backing buffer size) are different numbers, and conflating them leads to writing past valid data or reading stale slots.
- Forgetting that `sort()` on a JS array without a comparator sorts elements as strings by default (`[10, 2, 1].sort()` gives `[1, 10, 2]`), which silently produces wrong results for numeric data.

## Interview Questions & Answers

**Q: Why is array indexing O(1) but linked list indexing O(n)?**
A: Array elements are stored contiguously and are all the same size, so the address of element `i` can be computed directly as `base + i * elementSize` — a single arithmetic operation regardless of array size. A linked list has no such formula because nodes can live anywhere in memory; the only way to reach the k-th node is to follow `next` pointers starting from the head, which takes O(n) time in the worst case.

**Q: Explain why dynamic array push is "amortized O(1)" rather than just O(1). Walk through the math.**
A: Most pushes just write into unused capacity — O(1). But when the buffer is full, a push triggers a resize: allocate a new (typically 2x) buffer and copy all n existing elements, which is O(n). If capacity doubles at 1, 2, 4, 8, ..., n, the total copying cost across n pushes is 1+2+4+...+n ≈ 2n. Dividing that total cost by n operations gives O(1) per operation on average — that's the amortized bound. Any single push can still spike to O(n); "amortized" is a statement about the long-run average, not a worst-case guarantee for any individual call.

**Q: Given a sorted array, how would you find two numbers that sum to a target value in O(n) time?**
A: Use two pointers starting at opposite ends. If `arr[left] + arr[right] === target`, return them. If the sum is too small, move `left` right to increase it; if too large, move `right` left to decrease it. Because the array is sorted, each move eliminates one candidate pair from consideration, so the pointers meet after at most n steps — O(n) time, O(1) space. (Without the sorted-array guarantee, you'd instead use a hash set to track complements, also O(n) time but O(n) space.)

**Q: What's the time complexity of `Array.prototype.splice()` and why?**
A: O(n) in general, because removing or inserting elements at an arbitrary index requires shifting every subsequent element left or right by one position to keep the array contiguous — there's no way to open or close a gap in a contiguous block without touching everything after it. Splicing at the very end is effectively O(1) per removed/inserted element since nothing needs to shift.

**Q: How would you reverse an array in place without allocating a second array?**
A: Use two pointers, one starting at index 0 and one at `length - 1`. Swap the elements they point to, then move the left pointer forward and the right pointer backward, stopping when they meet or cross. This touches each element exactly once (in pairs), giving O(n) time and O(1) auxiliary space, versus building a new reversed array which would cost O(n) extra space.

## Related Topics

- [linked-lists.md](./linked-lists.md)
- [hash-tables.md](./hash-tables.md)
- [sorting-algorithms.md](./sorting-algorithms.md)
- [searching-algorithms.md](./searching-algorithms.md)
- [time-complexity.md](./time-complexity.md)
- [space-complexity.md](./space-complexity.md)
- [big-o-notation.md](./big-o-notation.md)
