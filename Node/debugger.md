# Debugger

Node.js ships with a built-in debugging protocol implementation rather than requiring a separate tool: pass `--inspect` (or the break-on-start variant `--inspect-brk`) when starting `node`, and the process opens a WebSocket-based debugging server that speaks the same Chrome DevTools Protocol (CDP) used by Chrome itself. This means any CDP-compatible client — Chrome's own DevTools (via `chrome://inspect`), VS Code, WebStorm, or other IDEs — can attach to a running Node process, set breakpoints, step through code, inspect variables and the call stack, profile CPU/memory, and evaluate expressions in the paused context, all using tooling most JS developers already know from browser debugging.

`--inspect` starts the process normally and opens the debug port (default `9229`) without pausing execution, which is useful for attaching to a long-running server to investigate it live. `--inspect-brk` does the same thing but pauses execution on the very first line of your script before any code runs, which is essential when you need to debug something that happens during startup/module initialization — without it, a client that connects a few hundred milliseconds late could miss the relevant code entirely. Both flags also work with `--inspect=0.0.0.0:PORT` to bind on all interfaces (needed when debugging a process running inside a container or remote machine), though exposing the inspector publicly is a real security risk since anyone who can reach that port gets arbitrary code execution in your process — the inspector protocol is explicitly not authenticated.

Aside from the DevTools-protocol route, Node also has `node inspect script.js`, a simpler built-in command-line debugger (no browser/IDE needed) that gives you a REPL-like interface with commands like `cont`/`c` (continue), `next`/`n` (step over), `step`/`s` (step into), `out`/`o` (step out), `setBreakpoint`/`sb`, `watch`, and `repl` (drop into a REPL scoped to the current paused frame). It's less pleasant than a graphical debugger but works over plain SSH with no port forwarding, which matters for debugging on headless remote servers.

The plain `debugger;` statement, written directly in your source, is a programmatic breakpoint — it's a no-op unless a debugger client is actually attached (via `--inspect`/`--inspect-brk` or `node inspect`), in which case execution pauses right there, exactly like a manually set breakpoint. VS Code integrates all of this through `launch.json` configurations: a `"type": "node"` config with `"request": "launch"` starts and attaches automatically (VS Code adds `--inspect` for you), while `"request": "attach"` connects to an already-running process you started separately with `--inspect`. Common real workflows include attaching post-mortem to a hung production-like process to inspect its call stack, using `--inspect-brk` with a test runner to debug a specific failing test from the very first line, and combining the inspector with `node --prof`/CPU profiling flags or the `v8` module's heap snapshot tools when the issue is a performance or memory problem rather than a logic bug.

## Examples

```js
// server.js — start with: node --inspect server.js  (or --inspect-brk to pause on line 1)
import http from 'node:http';

function computeTotal(items) {
  let total = 0;
  for (const item of items) {
    debugger; // execution pauses HERE when a debugger client is attached, otherwise a no-op
    total += item.price * item.quantity;
  }
  return total;
}

http.createServer((req, res) => {
  const total = computeTotal([{ price: 9.99, quantity: 3 }]);
  res.end(`Total: ${total}`);
}).listen(3000);

// Then open chrome://inspect in Chrome, or connect VS Code's debugger, to hit the breakpoint.
```

```js
// Using node's built-in CLI debugger without any GUI — run: node inspect calc.js
// calc.js
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

console.log(add(2, 3));
console.log(multiply(4, 5));

// In the `node inspect` REPL you'd then type commands like:
//   sb('calc.js', 2)   -> set a breakpoint at line 2 (inside add)
//   c                  -> continue execution until the breakpoint
//   repl               -> drop into a REPL scoped to the paused frame to inspect `a`, `b`
//   n                  -> step to the next line
//   c                  -> continue to completion
```

```json
// .vscode/launch.json — two common configurations: launching fresh vs attaching to a running process
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug current file",
      "program": "${file}",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to running process on 9229",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

## Common Pitfalls / Gotchas

- Using `--inspect` instead of `--inspect-brk` when you need to debug code that runs during module load/startup — by the time a client connects, the relevant code may have already executed.
- Exposing the inspector port on a public/untrusted network interface (`--inspect=0.0.0.0`) — the CDP inspector protocol has no built-in authentication, so anyone who can reach that port can execute arbitrary code in your process; this is a genuine, documented remote-code-execution risk (CVE-worthy pattern), not a theoretical one.
- Forgetting that `debugger;` statements are completely inert (a no-op, zero runtime cost beyond the statement itself) unless an inspector client is actively attached — leaving them in code is generally harmless but shouldn't be the primary breakpoint strategy since it requires editing source.
- Port collisions: `--inspect` defaults to port 9229, and if you're debugging multiple Node processes simultaneously (e.g., `cluster` workers) they'll try to use the same port unless you assign each a distinct one (`--inspect=9230`, etc.), or use `--inspect-port=0` for a random free port.
- Not adding `skipFiles: ["<node_internals>/**"]` in VS Code launch configs, causing "step into" to wander into Node's internal bootstrap code.
- Debugging asynchronous code and losing track of the call stack across `await`/callback boundaries — modern DevTools/VS Code show "async stack traces," but this depends on source maps and the runtime version being reasonably current.
- Trying to attach `node inspect`'s CLI debugger to a process that was started without any inspect flag — you need to either start it fresh under `node inspect`, or send `SIGUSR1`/attach with a separate `--inspect` client to an already-running POSIX process.

## Interview Questions & Answers

**Q: What's the difference between `--inspect` and `--inspect-brk`?**
A: Both open a Chrome DevTools Protocol debugging port (default 9229) that a client can attach to. `--inspect` starts running the script immediately without pausing, so it's suited to attaching to an already-running or long-lived process. `--inspect-brk` additionally pauses execution on the very first line before any application code runs, which is necessary when you need to catch something that happens during startup or module initialization, since a client attaching even slightly late under plain `--inspect` could miss it entirely.

**Q: How does Node's `--inspect` debugging actually work under the hood?**
A: Node implements the Chrome DevTools Protocol (CDP), the same JSON-over-WebSocket protocol Chrome's own DevTools uses to debug web pages. When you pass `--inspect`, Node starts a WebSocket server on the given port that speaks this protocol — any compatible client (Chrome DevTools via `chrome://inspect`, VS Code, WebStorm) can connect to that socket, send commands like "set breakpoint at line X" or "evaluate this expression," and receive events like "execution paused" or "console.log was called."

**Q: Why is running `node --inspect=0.0.0.0:9229` in production considered dangerous?**
A: The inspector protocol has no built-in authentication or access control — whoever can open a connection to that port has full debugging capability, which includes evaluating arbitrary JavaScript in the process's context. That's effectively remote code execution. Binding to `0.0.0.0` (all network interfaces) instead of `127.0.0.1` (localhost only) exposes that port to anyone who can reach the host over the network, which is a well-known, exploited attack vector when inspector ports get left open on publicly reachable machines.

**Q: What does the `debugger;` statement do, and does it have any cost in production if left in code?**
A: It's a programmatic breakpoint — when a debugger client is attached (via `--inspect`/`--inspect-brk` or `node inspect`), execution pauses at that line exactly as if a breakpoint had been set there manually. When no debugger is attached, which is the normal case in production, it is a complete no-op with negligible overhead; it doesn't throw, doesn't log anything, and doesn't meaningfully affect performance. It's still generally cleaned up before shipping since it signals leftover debugging intent, but it isn't a functional bug to leave one in.

**Q: How would you debug a Node process that's already running in production without restarting it?**
A: If it wasn't started with an inspect flag, on POSIX systems you can send it `SIGUSR1` (e.g., `kill -USR1 <pid>`), which causes Node to dynamically activate the inspector on the default port for that already-running process, without a restart. You can then attach Chrome DevTools or VS Code's "attach" configuration to that port. This is particularly useful for diagnosing an issue in a live process (e.g., taking a CPU profile or heap snapshot) where restarting would lose the problematic state you're trying to observe.

## Related Topics

- [v8.md](./v8.md)
- [event-loop.md](./event-loop.md)
- [console.md](./console.md)
- [process-and-os.md](./process-and-os.md)
- [unit-tests.md](./unit-tests.md)
