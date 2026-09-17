# VM

The `node:vm` module lets you compile and run JavaScript source code within separate V8 **contexts** — essentially, separate global objects and separate sets of built-ins from your main program's context, all still inside the same process and the same V8 isolate. It's what's used, for example, to implement template engines that evaluate expressions, some sandboxed plugin systems, and REPL-like tools that need to run untrusted or dynamically generated code against a controlled global scope.

The core building blocks are `vm.Script`, which compiles a string of JS source into a reusable, pre-parsed script object (useful if you're going to run the same code repeatedly, since it avoids re-parsing), and functions like `vm.runInNewContext(code, sandboxObject)`, `vm.runInContext(code, context)`, and `vm.runInThisContext(code)`. `vm.createContext(sandboxObject)` "contextifies" a plain object, turning it into the global object for a new V8 context — properties you put on that object become global variables visible to code run inside that context, and (depending on the API used) globals declared by the running code get attached back onto that same sandbox object, giving you a way to both provide a restricted set of globals to untrusted code and inspect what it produced.

The single most important interview fact about this module: **`vm` is not a security sandbox**, despite superficially looking like one and despite being commonly reached for as if it were one. The Node.js documentation itself explicitly warns about this. Code run via `vm` still executes with the full privileges of the host Node.js process — it is not isolated from the filesystem, network, or system resources the way an OS-level sandbox or container is. Multiple well-known "vm escape" techniques exist (for example, obtaining a reference to the real, un-contextified `constructor`/prototype chain and walking it back out to unrestricted globals) that let sufficiently crafted malicious code break out of the supposed sandbox and access `process`, `require`, or the filesystem from *inside* code that was meant to be constrained. If you genuinely need to run untrusted code safely, the honest answer in an interview is to reach for actual OS-level isolation — a separate process with restricted permissions, a container, a `worker_thread` combined with strict permission models, or a dedicated sandboxing product (e.g., `isolated-vm`, or V8 isolates run outside the Node process entirely, or serverless/microVM isolation like Firecracker) — not the `vm` module.

Where `vm` genuinely is useful and appropriate is for running code that is dynamically generated but *trusted* (or at least not actively adversarial) — for example, evaluating a mathematical expression or a small templating/DSL snippet where you want a clean, controlled set of globals rather than access to the calling scope's full closure and Node's `require`/`process`/`global`, or for building developer tools like REPLs where you want isolated evaluation contexts per session without spinning up separate processes.

## Examples

```js
// Basic vm.createContext + runInContext: evaluating expressions against a controlled global scope
import vm from 'node:vm';

const sandbox = { x: 10, y: 20, result: undefined };
vm.createContext(sandbox); // sandbox is now a distinct V8 global object

vm.runInContext('result = x + y;', sandbox);
console.log(sandbox.result); // 30

// Code run in this context cannot see the outer scope's variables or Node's `require`/`process`
// unless they were explicitly placed on `sandbox` beforehand.
```

```js
// vm.Script: compile once, run many times — useful for repeatedly evaluating the same template/expression
import vm from 'node:vm';

const script = new vm.Script('greeting = `Hello, ${name}!`;');

const context1 = vm.createContext({ name: 'Asha', greeting: undefined });
const context2 = vm.createContext({ name: 'Ravi', greeting: undefined });

script.runInContext(context1);
script.runInContext(context2);

console.log(context1.greeting); // "Hello, Asha!"
console.log(context2.greeting); // "Hello, Ravi!"
```

```js
// Demonstrating that vm is NOT a real security sandbox — this "escape" is a well-known category
import vm from 'node:vm';

const sandbox = vm.createContext({});

// Even with an empty sandbox, code can walk the constructor chain to reach an unrestricted
// Function constructor and execute arbitrary code with the SAME privileges as the host process.
const maliciousCode = `
  const AF = (function(){}).constructor;
  const unrestrictedFn = new AF('return process')();
`;

try {
  vm.runInContext(maliciousCode, sandbox);
  // In vulnerable setups this can retrieve the real, unrestricted `process` object,
  // proving the "sandbox" boundary does not actually stop determined malicious code.
} catch (err) {
  console.log('blocked (context-dependent):', err.message);
}
// Conclusion: never run genuinely untrusted code through vm expecting isolation guarantees.
```

## Common Pitfalls / Gotchas

- Treating `vm` as a security boundary for running untrusted/third-party code — it is explicitly documented as NOT a security mechanism; known escape techniques exist to reach the real process globals.
- Confusing "separate context" with "separate process" — `vm` contexts still run in the same OS process, the same memory space, and can still exhaust CPU/memory or hang the event loop (an infinite loop in `vm`-run code blocks the whole Node process, just like normal code, unless you pass a `timeout` option).
- Forgetting that without an explicit `timeout` option, `vm.runInContext`/`vm.Script.runInContext` will run indefinitely if the code contains an infinite loop, freezing the entire process.
- Assuming globals like `require`, `process`, `Buffer`, or `console` are unavailable inside a `vm` context by default — some are indeed absent unless explicitly injected, but this is fragile and not equivalent to actual privilege restriction.
- Not realizing that objects passed into the sandbox are passed by reference — mutations made by code running inside the `vm` context can affect the real objects in your outer scope if you handed them in directly instead of deep-cloning.
- Using `vm` for simple string templating when a proper templating library (or even just template literals with a controlled data object) would be simpler and avoid the sandbox-illusion trap entirely.
- Reusing a single `vm.createContext()` sandbox across multiple untrusted executions and assuming state doesn't leak between them — global state set by one execution persists and is visible to the next execution in that same context.

## Interview Questions & Answers

**Q: Is the `node:vm` module a security sandbox? Can you safely run untrusted user code with it?**
A: No — despite the name and the apparent isolation, Node's own documentation explicitly states `vm` does not provide a security mechanism for running untrusted code. Code executed via `vm` still runs with the full privileges of the host process, and there are known techniques to escape the "sandbox" and reach unrestricted globals like `process`. To actually run untrusted code safely you need real isolation — a separate OS process with restricted permissions, a container, or a dedicated isolation product — not `vm` alone.

**Q: What does `vm.createContext()` actually do?**
A: It takes a plain JavaScript object and "contextifies" it, turning it into the global object of a brand-new V8 context (with its own set of built-ins, separate from your main program's global object). Code subsequently run against that context via `vm.runInContext()` sees the properties on that object as its globals, and any new globals the code declares get attached back onto that same object, so you can inspect the results afterward.

**Q: What's the difference between `vm.runInNewContext`, `vm.runInContext`, and `vm.runInThisContext`?**
A: `vm.runInThisContext` compiles and runs code using the *current* V8 context/global object (so it can't see your local closure variables, but does share globals with the calling code) — mainly useful to avoid `eval`'s access to the local scope while still using the same globals. `vm.runInContext` runs code against a context you already created with `vm.createContext`, letting you reuse that context (and its accumulated state) across multiple executions. `vm.runInNewContext` is a convenience that creates a brand-new context from a sandbox object and runs the code once against it in a single call.

**Q: If `vm` isn't a real sandbox, what would you actually use to safely execute untrusted code in a Node.js application?**
A: Real isolation needs to happen at a level `vm` doesn't provide — options include running the untrusted code in a separate OS process with restricted permissions (dropped privileges, seccomp/AppArmor profiles), inside a container with strict resource and syscall limits, using a dedicated V8-isolate-based sandboxing library like `isolated-vm` that enforces stronger boundaries than core `vm`, or offloading to a microVM/serverless isolation layer (like Firecracker) designed specifically for running untrusted multi-tenant code.

## Related Topics

- [v8.md](./v8.md)
- [security.md](./security.md)
- [worker_threads.md](./worker_threads.md)
- [child-process.md](./child-process.md)
- [globals.md](./globals.md)
