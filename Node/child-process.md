# Child Process

The `node:child_process` module lets a Node.js program spawn and control other OS processes — running shell commands, other executables, or other Node.js scripts — and communicate with them through stdin/stdout/stderr streams or (for `fork`) a dedicated IPC channel. It's the foundation for things like running a linter/build tool from a Node script, shelling out to ImageMagick or ffmpeg, or launching a separate Node.js worker process that isn't a `cluster` worker.

There are four main functions, and picking the right one matters both for correctness and for security. `spawn(command, args, options)` launches a command directly (no shell involved unless you set `shell: true`), streams stdout/stderr incrementally via `.stdout`/`.stderr` (which are Readable streams), and is the best choice for long-running processes or ones that produce large amounts of output, since it never buffers the whole output in memory. `exec(command, options, callback)` runs a command *through a shell* (`/bin/sh` on POSIX, `cmd.exe` on Windows), buffers all of stdout/stderr into memory up to a default `maxBuffer` of 1MB (exceeding it kills the process with an error), and hands you the full output in a callback — convenient for short commands with small output, but because it goes through a shell, directly interpolating untrusted user input into the command string is a classic shell-injection vulnerability. `execFile(file, args, options, callback)` is like `exec` but runs the executable directly without a shell, so it's not vulnerable to shell metacharacter injection and is generally preferred over `exec` when you don't actually need shell features like pipes or globbing. `fork(modulePath, args, options)` is a specialized wrapper around `spawn` specifically for launching another Node.js script as a subprocess; it automatically sets up an IPC channel so the parent and child can exchange structured messages with `.send()`/`process.on('message')`, the same mechanism `cluster` is built on.

All variants (except when explicitly piped) give you access to the child's `stdin`, `stdout`, and `stderr` as streams via the `stdio` option, which can be configured per-stream as `'pipe'` (default, gives you a Node stream), `'inherit'` (child shares the parent's file descriptors directly), or `'ignore'`. You can also redirect a child's stdio to another child process's stdio to build actual OS-level pipelines. `spawn`/`fork` return a `ChildProcess` object immediately (asynchronous, non-blocking), while there are also synchronous counterparts — `spawnSync`, `execSync`, `execFileSync` — that block the event loop until the subprocess exits, useful in CLI scripts and build tooling where blocking is acceptable but never appropriate inside a server request handler.

Security is a frequent interview topic here: any time user-controlled input is interpolated into a command string passed to `exec` (or `spawn`/`exec*` with `shell: true`), an attacker can inject shell metacharacters (`;`, `&&`, `|`, backticks, `$()`) to run arbitrary commands. The fix is to avoid `exec`/`shell: true` for anything touching user input, and instead use `execFile` or `spawn` with the command and its arguments passed as a proper array — since no shell is invoked, there's no shell syntax for an attacker to inject.

## Examples

```js
// spawn: streaming output from a long-running command without buffering it all in memory
import { spawn } from 'node:child_process';

const child = spawn('ping', ['-c', '4', 'example.com']); // POSIX; use ['-n','4', ...] on Windows

child.stdout.on('data', (chunk) => {
  process.stdout.write(`stdout: ${chunk}`);
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(`stderr: ${chunk}`);
});

child.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});
```

```js
// execFile: safely running a file with user-supplied arguments, no shell involved
import { execFile } from 'node:child_process';

function convertImage(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // Arguments are passed as an array — no shell parsing, so shell injection isn't possible
    // even if inputPath/outputPath come from user input.
    execFile('convert', [inputPath, '-resize', '50%', outputPath], (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve({ stdout, stderr });
    });
  });
}

// Contrast: this would be UNSAFE if inputPath came from user input, due to shell interpolation:
// exec(`convert ${inputPath} -resize 50% ${outputPath}`, callback);
```

```js
// fork: launching another Node.js script and exchanging structured messages over IPC
// parent.js
import { fork } from 'node:child_process';

const child = fork('./worker-script.js');

child.on('message', (msg) => {
  console.log('Parent received:', msg);
});

child.send({ type: 'task', payload: { a: 5, b: 7 } });

// worker-script.js
process.on('message', (msg) => {
  if (msg.type === 'task') {
    const sum = msg.payload.a + msg.payload.b;
    process.send({ type: 'result', sum });
  }
});
```

## Common Pitfalls / Gotchas

- Building an `exec()` command string by interpolating user input (`exec(\`ls ${userInput}\`)`) — this is a textbook shell injection vulnerability; use `execFile`/`spawn` with an arguments array instead.
- Hitting `exec`'s default 1MB `maxBuffer` limit on commands that produce a lot of output — the process gets killed with an `ERR_CHILD_PROCESS_STDOUT_MAXBUFFER`-style error; either raise `maxBuffer` or switch to `spawn` and stream the output instead of buffering it.
- Forgetting that `spawn` does not use a shell by default, so shell features like `*` globbing, `&&`, `|` pipes, or environment variable expansion in the command string simply won't work unless you pass `{ shell: true }` (which reintroduces the injection risk if the input isn't trusted).
- Not handling the `'error'` event on a `ChildProcess` — if the executable doesn't exist or can't be spawned (e.g., `ENOENT`), that surfaces as an `'error'` event, not just a non-zero exit code.
- Using the synchronous variants (`execSync`, `spawnSync`) inside a server's request handler — they block the entire event loop until the subprocess finishes, stalling every other concurrent request.
- Leaving zombie/orphaned child processes running because the parent exited without killing them — long-lived children should be explicitly tracked and terminated (`child.kill()`) on parent shutdown.
- Assuming `fork()` works for spawning non-Node executables — `fork` is specifically for launching other Node.js scripts (it sets up an IPC channel and expects a Node runtime); use `spawn`/`execFile` for arbitrary executables.
- Not checking both the exit `code` and `signal` in the `'exit'`/`'close'` event — a process killed by a signal (e.g., `SIGKILL`) reports `code: null` and the signal name instead.

## Interview Questions & Answers

**Q: What are the differences between `spawn`, `exec`, `execFile`, and `fork`?**
A: `spawn` runs a command directly (no shell by default) and streams stdout/stderr — best for long-running processes or large output. `exec` runs the command through a shell and buffers all output into memory (subject to a `maxBuffer` limit, default ~1MB) — convenient for short commands but vulnerable to shell injection if the command string includes unsanitized input. `execFile` is like `exec` but skips the shell and runs the executable directly, avoiding shell-injection risk while still buffering output. `fork` is a specialized version of `spawn` for launching another Node.js script, automatically wiring up an IPC channel for `.send()`/`message` communication between parent and child.

**Q: Why is `exec()` considered risky with user input, and how do you avoid it?**
A: `exec()` runs its command string through a system shell, so any shell metacharacters in the string (`;`, `&&`, `|`, backticks, `$()`) are interpreted by the shell, not treated as literal text. If user input is concatenated into that string, an attacker can inject additional commands. The fix is to use `execFile` or `spawn` with the command and arguments passed as a separate array — since there's no shell parsing step, there's no injection surface, regardless of what characters are in the arguments.

**Q: How does `child_process.fork()` differ from `spawn()`, mechanically?**
A: `fork()` is implemented on top of `spawn()` but is specialized for spawning new Node.js processes running a given JS module: it automatically adds an IPC (inter-process communication) channel between parent and child, exposed as `.send()` on both sides and the `'message'` event, and it defaults to invoking the `node` executable on the given script path. Plain `spawn()` has no built-in IPC and can launch any executable, not just Node scripts (though you can request an IPC channel manually via the `stdio` option).

**Q: What's the danger of using `execSync`/`spawnSync` inside a web server?**
A: They block the calling thread — which, in Node, is the single thread running the event loop — until the subprocess exits. That means no other request, timer, or I/O callback can be processed while it's running, effectively freezing the entire server for every concurrent user, not just the one who triggered the subprocess. Synchronous variants are appropriate for one-off CLI scripts or build tooling, not request-handling code paths.

**Q: How would you stream a large file through an external command without loading it all into memory?**
A: Use `spawn` (not `exec`, which buffers) and pipe Node streams directly to/from the child's stdio — e.g., `fs.createReadStream(file).pipe(child.stdin)` and `child.stdout.pipe(fs.createWriteStream(outFile))`. Because `spawn`'s stdio are real Node Readable/Writable streams, backpressure is handled automatically and the data never needs to be fully buffered in the parent process's memory.

## Related Topics

- [cluster.md](./cluster.md)
- [worker_threads.md](./worker_threads.md)
- [streams.md](./streams.md)
- [security.md](./security.md)
- [process-and-os.md](./process-and-os.md)
- [event-loop.md](./event-loop.md)
