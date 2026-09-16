# JavaScript Interview Prep

This folder is a personal knowledge base for studying and teaching core JavaScript concepts, built for interview preparation and for explaining these topics to others. Each file covers one topic in depth — a conceptual explanation, runnable code examples, common pitfalls, and interview-style Q&A — so you can both refresh your own understanding quickly and use the material to walk someone else through the same concept from scratch.

## Table of Contents

### Language Fundamentals
- [History of JavaScript](./history-of-javascript.md)
- [Introduction to JavaScript](./introduction-to-javascript.md)
- [Basics of JavaScript](./basic-of-javascript.md)
- [How to Use JavaScript](./how-to-use-javascript.md)
- [JavaScript Statements](./javascript-statements.md)
- [Variables in JavaScript](./variables-in-javascript.md)
- [let & const](./let-and-const.md)
- [Global Variables](./global-variables.md)
- [Data Types in JavaScript](./datatypes-in-javascript.md)
- [Types in JavaScript](./types-in-javascript.md)
- [Primitive Types](./primitive-types.md)
- [Statically Typed](./static-typed.md)
- [Dynamically Typed](./dynamic-typed.md)
- [Type Coercion](./type-coercion.md)
- [Operators in JavaScript](./operators-in-javascript.md)
- [Loops in JavaScript](./loops-in-javascript.md)
- [Destructuring Assignment](./destructuring-assignment.md)
- [Spread Operator](./spread-operator.md)
- [Rest Parameter](./rest-parameter.md)
- [Default Parameters](./default-parameters.md)
- [Optional Chaining (?.)](./optional-chaining.md)
- [Nullish Coalescing (??)](./nullish-coalescing.md)
- [BigInt](./bigint.md)
- [Immutability](./immutability.md)
- [Pass by Value](./pass-by-value.md)
- [Pass by Reference](./pass-by-reference.md)

### Functions & Scope
- [Functions](./functions.md)
- [Types of Functions in JavaScript](./functions-in-javascript.md)
- [Arrow Functions](./arrow-function.md)
- [IIFE](./iife.md)
- [Function Invocation](./function-invocation.md)
- [Function Scope](./function-scope.md)
- [Block Scope](./block-scope.md)
- [Lexical Scope](./lexical-scope.md)
- [Lexical Environment](./lexical-environment.md)
- [Scope Chain](./scope-chain.md)
- [Dynamic Scope](./dynamic-scope.md)
- [Variable Environment](./variable-environment.md)
- [Execution Context](./execuation-context.md)
- [Hoisting](./hoisting.md)
- [Closures](./closures.md)
- [Higher-Order Functions](./higher-order-function.md)
- [Callbacks](./callbacks.md)
- [Currying](./currying.md)
- [Partial Application](./partial-application.md)
- [Compose](./compose.md)
- [Pipe](./pipe.md)
- [Pure Functions](./pure-function.md)
- [Functional Programming](./functional-programing.md)
- [The `this` Keyword](./this-keyword.md)
- [Function.prototype.call()](./call-function.md)
- [Function.prototype.apply()](./apply-function.md)
- [Function.prototype.bind()](./bind-function.md)
- [The `new` Keyword](./new-keyword.md)
- [Function vs Object](./function-vs-object.md)

### Asynchronous JavaScript
- [Asynchronous JavaScript](./asynchronus-javascript.md)
- [Error Handling](./error-handling.md)
- [Single-Threaded Model](./single-threaded-model.md)
- [Event Loop](./event-loop.md)
- [Microtask Queue (Job Queue)](./microtask-queue-or-job-queue.md)
- [Task Queue (Callback Queue)](./task-queue-callback-queue.md)
- [Promises](./promises.md)
- [Async/Await](./async-await.md)
- [Generators](./generators.md)
- [Iterators](./iterators.md)
- [for await...of](./for-await.md)
- [Web APIs](./web-apis.md)
- [Web Workers](./web-worker.md)
- [Threads](./threads.md)

### OOP & Prototypes
- [Object-Oriented Programming (OOP)](./object-oriented-programing.md)
- [OOP Concepts (Four Pillars)](./oop-concepts.md)
- [Classes](./classes.md)
- [Objects](./objects.md)
- [Objects in JavaScript](./objects-in-javascript.md)
- [Prototype](./prototype.md)
- [Prototypal Inheritance](./prototype-inheritence.md)
- [Inheritance](./inheritence.md)
- [Composition vs Inheritance](./composition-vs-inheritence.md)
- [Object.create()](./object-dot-create.md)
- [Private vs Public](./private-vs-public.md)

### Modules
- [Modules](./modules.md)
- [CommonJS Modules](./commonjs-module.md)
- [AMD](./amd.md)
- [UMD](./umd.md)
- [Native ES Modules](./native-es-module.md)
- [Dynamic Import](./dynamic-import.md)

### Modern ES Features
- [ES2015 (ES6)](./es2015.md)
- [ES2016 (ES7)](./es2016.md)
- [ES2017 (ES8)](./es2017.md)
- [ES2018 (ES9)](./es2018.md)
- [ES2019 (ES10)](./es2019.md)
- [ES2020 (ES11)](./es2020.md)

### Data Structures & Collections
- [Arrays](./arrays.md)
- [Array Methods](./array-methods.md)
- [Set & Map](./set-map.md)
- [WeakSet & WeakMap](./weak-set-weak-map.md)
- [Quick Sort](./quick-sort.md)

### Performance & Memory
- [Garbage Collection](./garbage-collection.md)
- [Call Stack & Memory Heap](./call-stack-and-memory-heap.md)
- [Stack Overflow & Memory Leaks](./stack-overflow-memory-leaks.md)
- [Writing Optimized JavaScript Code](./optimized-code.md)

### Runtime Internals
- [JavaScript Engine](./javascript-engine.md)
- [JavaScript Runtime](./javascript-runtime.md)
- [Node.js Runtime](./nodejs-runtime.md)
- [Interpreter](./interpreter.md)
- [Compiler](./compiler.md)
- [JIT Compiler](./jit-compiler.md)
- [AOT Compiler](./aot-compiler.md)

## Interview Questions & Answers — Curated

**1. What's the difference between `==` and `===`, and what are some surprising edge cases? (Beginner/Intermediate)**
`==` performs type coercion before comparing; `===` compares both type and value with no coercion. Surprising cases: `null == undefined` is `true` (special-cased), but `null === undefined` is `false`; `[] == false` is `true` (`[]` coerces to `""` then `0`); `NaN === NaN` is `false` under either operator, since `NaN` never equals itself. Default to `===` in almost all code.

**2. Explain the event loop end-to-end, with an example that logs in a surprising order. (Advanced)**
```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');
// Output: 1, 4, 3, 2
```
Synchronous code runs first (`1`, `4`). Then the engine fully drains the microtask queue (Promise callbacks) before touching the macrotask queue, so `3` logs before `2`, even though `setTimeout` was scheduled first and with a `0ms` delay. See [event-loop.md](./event-loop.md).

**3. How does `this` binding work across regular functions, arrow functions, and `call`/`apply`/`bind`? (Intermediate/Advanced)**
Regular functions resolve `this` dynamically based on the call site: `new` binding > explicit (`call`/`apply`/`bind`) > implicit (`obj.method()`) > default (`undefined`/global). Arrow functions have no `this` of their own — they inherit it lexically from the enclosing scope at definition time, ignoring call-site rules entirely. `.call()`/`.apply()` invoke immediately with an explicit `this`; `.bind()` returns a new function with `this` permanently fixed. See [this-keyword.md](./this-keyword.md).

**4. What is a closure, and why does the classic `var` in a `for` loop + `setTimeout` bug happen? (Intermediate)**
A closure is a function bundled with a persistent reference to its lexical scope, retaining access to outer variables after the outer function returns. `var` is function-scoped, so a loop using `var` shares one binding across all iterations — by the time any deferred callback runs, the loop has finished and every callback sees the final value. `let` creates a fresh binding per iteration, fixing this. See [closures.md](./closures.md).

**5. What's the difference between `null` and `undefined`? (Beginner)**
`undefined` means a variable has been declared but not assigned a value (or a function returned nothing, or an object property doesn't exist). `null` is an explicit, intentional "no value," assigned deliberately by code. `typeof undefined` is `"undefined"`; `typeof null` is `"object"` (a long-standing spec quirk). `null == undefined` is `true`; `null === undefined` is `false`.

**6. Explain prototypal inheritance and how `class`/`extends` relates to it. (Intermediate)**
Every object links to a prototype object, and property lookups walk up this prototype chain until found or exhausted. `class`/`extends` (ES2015) is syntax sugar over this same mechanism — methods land on `.prototype`, and `extends` links a child class's prototype to its parent's. See [prototype.md](./prototype.md) and [prototype-inheritence.md](./prototype-inheritence.md).

**7. What's the difference between `Promise.all()`, `Promise.allSettled()`, `Promise.race()`, and `Promise.any()`? (Advanced)**
`Promise.all()` resolves with all values only if every promise fulfills, rejecting immediately on any single rejection. `Promise.allSettled()` always resolves once every promise settles, giving the outcome of each individually. `Promise.race()` settles as soon as the first promise settles (fulfilled or rejected). `Promise.any()` fulfills as soon as the first one fulfills, ignoring rejections unless all reject. See [promises.md](./promises.md).

**8. How does hoisting differ between `var`, `let`/`const`, and function declarations? (Intermediate)**
`var` is hoisted and initialized to `undefined`. `let`/`const` are hoisted but left in the Temporal Dead Zone — accessing them before their declaration throws a `ReferenceError`. Function declarations are hoisted completely, with their body attached, callable before their line in the source. Function expressions/arrow functions are not hoisted as callable values — only their variable binding is. See [hoisting.md](./hoisting.md).

**9. What are pure functions, and why do they matter? (Beginner/Intermediate)**
A pure function always returns the same output for the same input and causes no observable side effects (no mutation, no I/O, no dependency on external mutable state). They're trivially testable, safely memoizable, and easy to reason about in isolation. See [pure-function.md](./pure-function.md).

**10. What's the difference between shallow copy and deep copy, and how do you do each in JavaScript? (Intermediate)**
A shallow copy (`{...obj}`, `Object.assign({}, obj)`, `array.slice()`) copies only the top level — nested objects remain shared references. A deep copy duplicates every nested level independently, achievable via `structuredClone(obj)`, a recursive clone utility, or (with caveats around functions/dates/circular refs) `JSON.parse(JSON.stringify(obj))`. See [immutability.md](./immutability.md) and [pass-by-reference.md](./pass-by-reference.md).

**11. Explain the differences between CommonJS and ES Modules. (Intermediate/Advanced)**
CommonJS (`require`/`module.exports`) is synchronous and dynamic, resolved at runtime, returning a snapshot of `module.exports`. ES Modules (`import`/`export`) are statically analyzable (resolved at parse time, enabling tree-shaking) and provide live bindings — an imported value automatically reflects later updates from the exporting module. See [modules.md](./modules.md).

**12. What is event delegation, and how does it relate to event bubbling? (Intermediate)** *(DOM/browser-adjacent, frequently paired with JS fundamentals questions)*
Most DOM events bubble from the target element up through its ancestors. Event delegation exploits this by attaching a single listener to a common ancestor rather than to each individual child, inspecting `event.target` inside the handler to determine which child actually triggered it — reducing the number of listeners needed, especially for dynamically added elements.

**13. How would you implement debounce and throttle, and what's the difference? (Advanced)**
Debounce delays invoking a function until a pause of a specified duration has occurred since the last call (useful for search-input handlers). Throttle ensures a function runs at most once per specified interval, regardless of how many times it's triggered (useful for scroll/resize handlers). Both rely on closures and `setTimeout` internally. See [closures.md](./closures.md) and [higher-order-function.md](./higher-order-function.md).

**14. What's the difference between `Object.freeze()` and `const`? (Intermediate)**
`const` only prevents reassigning the variable binding — the object it points to remains fully mutable. `Object.freeze()` makes an object's own top-level properties immutable (non-writable, non-configurable) — but only shallowly; nested objects remain mutable unless separately frozen. See [immutability.md](./immutability.md).

**15. Explain how `async`/`await` relates to Promises and the event loop. (Advanced)**
`async`/`await` is syntax sugar over Promises: an `async` function always returns a Promise, and `await` pauses that function's execution (not the whole program) until the awaited Promise settles, resuming the remainder as a microtask. It doesn't add new async capability — it changes how the code reads. See [async-await.md](./async-await.md).

**16. What are `Map` and `Set`, and why use them over plain objects/arrays? (Intermediate)**
`Map` allows any value (not just strings/Symbols) as a key, doesn't inherit from `Object.prototype` (avoiding accidental key collisions), and maintains insertion order. `Set` enforces uniqueness with O(1) average membership checks, faster than `array.includes()`'s linear scan. See [set-map.md](./set-map.md).

**17. What is currying, and how does it differ from partial application? (Advanced)**
Currying transforms `f(a, b, c)` into a chain of unary functions, `f(a)(b)(c)`. Partial application fixes any subset of arguments up front (in any grouping), returning a function needing only the rest — it doesn't require reducing everything to single-argument calls. See [currying.md](./currying.md) and [partial-application.md](./partial-application.md).

**18. Why does JavaScript need a garbage collector, and how does mark-and-sweep work? (Intermediate)**
JavaScript manages memory automatically rather than requiring manual allocation/deallocation. Mark-and-sweep starts from root references (global scope, active call stacks), marks everything reachable from them, then frees everything left unmarked — correctly handling circular references that naive reference counting could never collect. See [garbage-collection.md](./garbage-collection.md).

**19. What's the difference between synchronous and asynchronous code, and does "asynchronous" mean "parallel" in JavaScript? (Beginner/Intermediate)**
Synchronous code runs top-to-bottom, blocking further execution until each line finishes. Asynchronous code defers some work (via callbacks, Promises, `async`/`await`) so the program can continue running other code while waiting. Asynchronous does not mean parallel — JavaScript's main thread still runs one thing at a time; true parallelism requires Web Workers or Node's `worker_threads`. See [asynchronus-javascript.md](./asynchronus-javascript.md) and [single-threaded-model.md](./single-threaded-model.md).

**20. How do private class fields (`#field`) differ from convention-based (`_field`) and closure-based privacy? (Advanced)**
`_field` is purely a naming convention with zero enforcement — fully accessible externally. Closures provide genuine privacy (the variable simply isn't a property on the returned object) but require a factory-function pattern rather than `class`. Native `#field` (ES2022) is enforced directly by the engine within `class` syntax — accessing it from outside throws a `SyntaxError`. See [private-vs-public.md](./private-vs-public.md).

## How to Use This Folder

Work through the sections roughly in the order listed above — each builds conceptually on the last:

1. **Language Fundamentals** first — variables, types, coercion, and operators are assumed knowledge everywhere else.
2. **Functions & Scope** next — closures, scope chains, and `this` are the mechanics behind almost every intermediate/advanced topic that follows.
3. **Asynchronous JavaScript** after that — the event loop, Promises, and `async`/`await` build directly on the function/scope fundamentals and are consistently a major focus in interviews.
4. **OOP & Prototypes** and **Modules** can be read in either order — both are largely independent of the async material, though OOP briefly touches closures (for private state) and Modules occasionally references async (`import()`).
5. **Modern ES Features**, **Data Structures & Collections**, **Performance & Memory**, and **Runtime Internals** are best read last — they're more specialized/systems-level, and understanding them well benefits from already being comfortable with scope, closures, and asynchronous execution.

For interview prep specifically: skim the per-topic "Interview Questions & Answers" sections first for quick review, then use the "Curated" list above as a cross-cutting mock-interview pass once you've refreshed the individual topics.
