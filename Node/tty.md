# TTY

The `node:tty` module provides utilities related to TTYs (teletypes — the historical name for terminal devices, still used to describe an interactive terminal/console). Its main practical purpose is letting a Node program detect, at runtime, whether its standard streams (`stdin`, `stdout`, `stderr`) are connected to an actual interactive terminal versus being piped to a file, another process, or run non-interactively (e.g., in a CI pipeline or as a cron job) — and to query terminal-specific properties like size and color support when a real TTY is present.

The single most commonly used piece of this module in practice isn't even a function you call directly — it's the `isTTY` boolean property that Node attaches to `process.stdin`, `process.stdout`, and `process.stderr`: `process.stdout.isTTY` is `true` when stdout is connected to an interactive terminal, and `undefined` (falsy) when it's redirected — for example, `node app.js > output.log` or `node app.js | grep foo` both cause `process.stdout.isTTY` to be `undefined`, because the other end isn't a terminal a human is looking at. This distinction matters a lot for CLI tool authors: things like colored output (ANSI escape codes), progress bars, spinners, and interactive prompts are only appropriate when writing to a real TTY — emitting raw ANSI color codes into a log file or a pipe destined for another program produces garbled, unreadable output (`\x1b[32mtext\x1b[0m` literally in a log file instead of green text), so well-behaved CLI tools check `isTTY` (directly, or via libraries like `chalk`/`picocolors` that do it for you) before deciding whether to colorize or animate output at all.

When stdout genuinely is a TTY, `node:tty`'s `WriteStream` class (which is what `process.stdout` actually is, in that case) exposes terminal dimensions via `.columns` and `.rows`, useful for anything that needs to lay out text to fit the terminal width — progress bars, table formatting, word-wrapping help text. These update live as the user resizes their terminal window, observable via the `'resize'` event on the stream. On the input side, `process.stdin` being a `tty.ReadStream` (when interactive) is what makes `readline`-based interactive prompts, and raw keypress-by-keypress input (`process.stdin.setRawMode(true)`, needed for building things like a custom key-driven TUI or intercepting Ctrl+C yourself) possible — `setRawMode` only exists/works when stdin is actually a TTY, so a script that tries to call it when input is being piped from a file will throw or no-op, and defensive CLI code needs to check `process.stdin.isTTY` first.

`node:readline`, built on top of `tty`, is the higher-level module most interview-relevant CLI-prompt code actually uses (`readline.createInterface`, `rl.question()`), but understanding that it depends on TTY detection underneath — and that the same script needs to behave sensibly whether run interactively by a human or non-interactively in a pipeline/CI — is the core interview-relevant concept for this module.

## Examples

```js
// Detecting whether stdout is an interactive terminal before deciding to colorize/animate output
import process from 'node:process';

function log(message) {
  if (process.stdout.isTTY) {
    // Safe to use ANSI color codes — a human is watching a real terminal
    console.log(`\x1b[32m${message}\x1b[0m`); // green text
  } else {
    // Output is piped/redirected (e.g. `node app.js > out.log`) — keep it plain
    console.log(message);
  }
}

log('Build succeeded'); // green in a terminal, plain text when redirected to a file
```

```js
// Using terminal dimensions to render a simple width-aware progress bar, only when a TTY is present
import process from 'node:process';

function renderProgress(percent) {
  if (!process.stdout.isTTY) {
    // No terminal to draw into (e.g. running in CI) — just log periodically instead
    if (percent % 25 === 0) console.log(`Progress: ${percent}%`);
    return;
  }

  const width = process.stdout.columns || 80; // .columns is only meaningful on a real TTY
  const barWidth = width - 10;
  const filled = Math.round((barWidth * percent) / 100);
  const bar = '#'.repeat(filled) + '-'.repeat(barWidth - filled);

  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(`[${bar}] ${percent}%`);
}

for (let p = 0; p <= 100; p += 20) renderProgress(p);
```

```js
// Raw mode keypress handling for a custom interactive CLI control (e.g. "press q to quit")
import process from 'node:process';

function listenForQuit() {
  if (!process.stdin.isTTY) {
    console.log('Not an interactive terminal — skipping keypress listener.');
    return;
  }

  process.stdin.setRawMode(true); // only valid when stdin is a real TTY
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (key) => {
    if (key === 'q' || key === '') { // 'q' or Ctrl+C
      console.log('\nExiting...');
      process.stdin.setRawMode(false);
      process.exit(0);
    }
  });

  console.log('Press "q" to quit.');
}

listenForQuit();
```

## Common Pitfalls / Gotchas

- Unconditionally emitting ANSI color/escape codes without checking `isTTY` first — when output is redirected to a file or piped into another program, raw escape sequences show up as garbage characters instead of being rendered.
- Calling `process.stdin.setRawMode(true)` without checking `process.stdin.isTTY` first — this throws (or is a no-op depending on platform/version) when stdin isn't an actual terminal, e.g., when input is piped from a file or another process.
- Assuming `process.stdout.columns`/`.rows` are always defined — they're only meaningful (non-`undefined`) when `isTTY` is true; code that formats output to terminal width needs a sensible fallback (e.g., 80 columns) for the non-TTY case.
- Forgetting that CI environments (GitHub Actions, Jenkins, etc.) run commands non-interactively, so `isTTY` is `undefined`/`false` there even though some CI UIs render ANSI colors — many CLI tools handle this with an explicit `FORCE_COLOR` environment variable override rather than relying on `isTTY` alone.
- Not listening for the `'resize'` event when building something that needs to stay laid out correctly as the user resizes their terminal window (progress bars, TUIs).
- Leaving `setRawMode(true)` engaged and not resetting it back to `false` before the process exits, which can leave the user's actual terminal in a broken input state after the program ends.
- Confusing "is this a TTY" with "does this terminal support color" — a real terminal can still have limited or no color support (e.g., certain minimal terminals, `TERM=dumb`); serious CLI tools check both TTY status and color-capability signals (as libraries like `chalk` do internally) rather than assuming any TTY implies full ANSI support.

## Interview Questions & Answers

**Q: What does `process.stdout.isTTY` tell you, and why does it matter for CLI tools?**
A: It tells you whether stdout is connected to an actual interactive terminal (`true`) or has been redirected/piped to a file or another process (`undefined`, falsy). It matters because behaviors that only make sense for a human watching a live terminal — ANSI colors, spinners, progress bars, cursor movement — produce garbled or meaningless output when written into a log file or piped into another program's stdin; well-behaved CLI tools check `isTTY` and fall back to plain, non-animated text output when it's false.

**Q: Why would `process.stdin.setRawMode(true)` throw or fail silently in some contexts?**
A: `setRawMode` puts the terminal into a mode where keypresses are delivered to the program immediately, one at a time, without line buffering or built-in line-editing — a capability that only exists when stdin is connected to a real TTY device. If stdin is instead piped from a file or another process's output (`cat file.txt | node app.js`), there's no actual terminal device to put into raw mode, so the call throws or has no effect depending on the platform, which is why defensive code checks `process.stdin.isTTY` first.

**Q: How would you detect terminal width to format text output, and what happens if there's no terminal?**
A: You'd read `process.stdout.columns` (and `.rows` for height), which `node:tty`'s `WriteStream` populates when stdout is a real TTY, and optionally listen for the `'resize'` event to react to the user resizing their terminal window. When stdout isn't a TTY (redirected to a file, piped, or running in most CI systems), `columns`/`rows` are `undefined`, so code needs a sensible fallback width (commonly 80 columns) rather than assuming the property is always populated.

**Q: Why might a CLI tool disable colored output in CI even though `isTTY` is technically false there?**
A: CI systems run commands non-interactively, redirecting stdout through their own log-capturing layer, so `process.stdout.isTTY` reports false even in CI UIs (like GitHub Actions) that are actually capable of rendering ANSI colors nicely in their web log viewer. Because relying on `isTTY` alone would disable color even where it'd render fine, many CLI tools respect an explicit override — commonly the `FORCE_COLOR` environment variable — to let users or CI configuration force color output on regardless of the raw TTY detection result.

## Related Topics

- [process-and-os.md](./process-and-os.md)
- [console.md](./console.md)
- [globals.md](./globals.md)
- [streams.md](./streams.md)
