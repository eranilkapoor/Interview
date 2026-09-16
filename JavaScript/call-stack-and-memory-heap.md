# Call Stack & Memory Heap

The **call stack** and the **memory heap** are the two core runtime memory structures a JavaScript engine uses to execute code. The call stack tracks the sequence of currently active function calls: whenever a function is invoked, a new **stack frame** (containing that call's local variables, arguments, and where to return to) is pushed onto the top of the stack; when the function returns, its frame is popped off, and execution resumes in whatever frame is now on top. Because it's a stack (Last-In-First-Out), function calls nest and unwind in a strict, predictable order — this is the concrete mechanism behind execution contexts (see [execuation-context.md](./execuation-context.md)) and behind errors like "Maximum call stack size exceeded" (a stack overflow, from runaway/unterminated recursion — see [stack-overflow-memory-leaks.md](./stack-overflow-memory-leaks.md)).

The **memory heap** is a much less structured region of memory used to store objects, arrays, and functions — anything whose size isn't known ahead of time or that needs to persist beyond a single function call's lifetime. When you write `const obj = { name: 'Anil' };`, the object itself is allocated in the heap, while the variable `obj` (a reference/pointer to that heap location) lives in whichever stack frame (or, for top-level code, the global execution context) the declaration occurs in. Primitives (numbers, strings, booleans, etc.) are typically stored directly in the stack frame itself (or inline, depending on engine internals) since their fixed, small size makes heap allocation unnecessary.

This stack/heap split is exactly why understanding pass-by-value vs pass-by-reference (see [pass-by-value.md](./pass-by-value.md), [pass-by-reference.md](./pass-by-reference.md)) requires understanding where data actually lives: copying a primitive copies its actual value (since it's stored directly); copying an object variable copies only the reference (the pointer to the heap location), leaving both variables pointing at the exact same heap-allocated object.

## Examples

```js
// The call stack grows and shrinks (LIFO) as functions call other functions
function subtract(a, b) { return a - b; } // pushed, runs, popped
function calculate(x, y) {
  const sum = x + y;         // 'calculate' frame active
  return subtract(sum, 2);    // pushes 'subtract' frame on top, then pops it on return
}
calculate(2, 5); // Stack sequence: [global] -> [global, calculate] -> [global, calculate, subtract] -> ...
```

```js
// Primitives live directly in the stack frame; objects are allocated on the heap, referenced from the stack
function example() {
  const a = 100;              // primitive — stored directly
  const obj = { value: 100 }; // object — allocated on the HEAP; `obj` in the stack frame holds a reference
  return obj;
}
const result = example(); // `example`'s stack frame is gone, but the heap object survives via `result`
console.log(result.value); // 100 — heap objects outlive the stack frame that created them, as long as referenced
```

```js
// Uncontrolled recursion exhausts the call stack (stack overflow)
function recurse() {
  return recurse(); // no base case — keeps pushing new frames until the stack's size limit is hit
}
try {
  recurse();
} catch (e) {
  console.log(e.message); // "Maximum call stack size exceeded" — a RangeError
}
```

## Common Pitfalls / Gotchas

- Assuming a function's local variables (stack frame) persist after it returns — they don't, unless a returned closure specifically keeps a reference to them (which then keeps the relevant heap-allocated data alive via that reference, not the original stack frame itself).
- Confusing "stack overflow" (too many nested function calls, exhausting the call stack) with a general "out of memory" error (heap exhaustion, from allocating too many/too-large objects) — they're related but distinct failure modes with distinct causes.
- Believing objects are literally "inside" the variable that references them — the variable (wherever it lives — a stack frame, or as a property of another heap object) merely holds a reference/pointer to the object's actual location in the heap.
- Forgetting recursive functions need a correct, reachable base case — otherwise the call stack grows without bound until it hits its (engine-specific, but always finite) size limit, throwing a `RangeError`.

## Interview Questions & Answers

**Q: What's the difference between the call stack and the memory heap?**
A: The call stack tracks active function calls in a strict Last-In-First-Out order, with each call's local variables/arguments stored in its own stack frame — it's fast, structured, and size-limited. The memory heap is a much less structured region used to store objects, arrays, and functions, whose sizes aren't fixed ahead of time and which may need to outlive the function call that created them; it's larger and managed via garbage collection rather than strict push/pop discipline.

**Q: What causes a "Maximum call stack size exceeded" error, and what kind of error is it?**
A: It's a `RangeError`, caused by the call stack growing beyond the engine's size limit — almost always from recursion with no reachable base case (or a base case that's never actually hit due to a logic bug), causing each recursive call to push another stack frame indefinitely until the stack's fixed capacity is exhausted.

**Q: Where does a primitive value live compared to an object, in terms of the stack/heap model?**
A: A primitive's actual value is typically stored directly within whichever stack frame (or heap-allocated object property) it's declared in, since its fixed, small size makes that efficient. An object is allocated in the heap, and any variable/property referencing it (wherever that variable itself lives) simply holds a reference/pointer to that heap location, not the object's actual data inline.

## Related Topics
- [execuation-context.md](./execuation-context.md)
- [stack-overflow-memory-leaks.md](./stack-overflow-memory-leaks.md)
- [garbage-collection.md](./garbage-collection.md)
- [pass-by-value.md](./pass-by-value.md)
- [pass-by-reference.md](./pass-by-reference.md)
