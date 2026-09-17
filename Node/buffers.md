# Buffers

A `Buffer` is Node's built-in class for working with raw binary data — fixed-length sequences of bytes allocated outside the regular V8 JavaScript heap. Before `Uint8Array` and other typed arrays were standardized in JavaScript, Node needed a way to handle binary data (file contents, TCP packets, image bytes) efficiently, since JS strings are UTF-16 and poorly suited for representing arbitrary bytes. `Buffer` was Node's answer, and it predates typed arrays in the language — today, `Buffer` is implemented as a subclass of `Uint8Array`, so every `Buffer` is also a valid `Uint8Array` and works with any API expecting one (like the Web Streams API or `TextEncoder`/`TextDecoder`), while adding Node-specific convenience methods (`.toString(encoding)`, `.write()`, `.slice()`/`.subarray()`, comparison and search methods, etc.).

There are three primary ways to create a Buffer, and the distinction matters both for correctness and security. `Buffer.from(data)` creates a buffer from existing data — a string (with an optional encoding, default `'utf8'`), an array of bytes, or another Buffer/TypedArray — copying that data in. `Buffer.alloc(size)` allocates a new buffer of `size` bytes and **zero-fills** it, guaranteeing no leftover memory content is exposed. `Buffer.allocUnsafe(size)` allocates a buffer of `size` bytes *without* zeroing it first — it's faster because it skips that initialization step, but the memory may contain old, potentially sensitive data from previous allocations until you explicitly overwrite every byte. `allocUnsafe` is a legitimate performance optimization for hot paths where you'll immediately fill the entire buffer yourself, but using it carelessly (e.g., returning partially-written buffer content to a client) is a real security bug class — leaking uninitialized memory contents.

Encoding is the other central concept: a Buffer is just raw bytes, and converting between bytes and text requires specifying how those bytes map to characters. Common encodings supported by `.toString(encoding)` and `Buffer.from(str, encoding)` include `'utf8'` (default, variable-width Unicode), `'base64'` (used for transmitting binary data as text, e.g., in JSON or URLs), `'hex'` (each byte as two hex characters, common for hashes/IDs), `'ascii'` (7-bit, legacy), `'latin1'`/`'binary'` (1 byte per character, no Unicode-aware encoding), and `'base64url'` (URL-safe base64, no `+`/`/`/padding issues). Getting the encoding wrong when converting silently corrupts multi-byte characters or produces garbage output rather than throwing — a frequent source of subtle bugs with non-ASCII text.

Performance-wise, Buffers avoid the overhead of JS string encoding/decoding and are the currency that streams, `fs`, `net`, `crypto`, and `zlib` APIs natively operate in — reading a file, receiving TCP data, or hashing content all produce/consume Buffers directly. Converting a Buffer to a string (and back) has a real cost for large payloads, so performance-sensitive code (e.g., proxying data, hashing large files) generally keeps data as Buffers/streams as long as possible and only decodes to a JS string at the point where text is actually needed.

## Examples

```js
// Creating buffers three different ways, and why allocUnsafe needs care
const safe = Buffer.alloc(16);          // zero-filled: [0, 0, 0, ..., 0]
const unsafe = Buffer.allocUnsafe(16);  // uninitialized: may contain old memory bytes
unsafe.fill(0);                         // must fully overwrite before it's safe to expose

const fromString = Buffer.from('hello', 'utf8');
const fromHex = Buffer.from('68656c6c6f', 'hex'); // same bytes as fromString

console.log(fromString.equals(fromHex)); // true -- identical byte content
console.log(safe.length, unsafe.length); // 16 16
```

```js
// Encoding round-trips: utf8, base64, hex
const original = 'Node.js 🚀';
const buf = Buffer.from(original, 'utf8');

console.log(buf.toString('hex'));    // raw bytes as hex, e.g. 4e6f64652e6a7320f09f9a80
console.log(buf.toString('base64')); // e.g. Tm9kZS5qcyDwn5qA

const roundTripped = Buffer.from(buf.toString('base64'), 'base64').toString('utf8');
console.log(roundTripped === original); // true -- base64 round-trip is lossless for bytes
```

```js
// Buffer is a Uint8Array subclass: interop with TypedArray/DataView and crypto hashing
const crypto = require('node:crypto');

const buf = Buffer.from('sensitive payload');
console.log(buf instanceof Uint8Array); // true

const hash = crypto.createHash('sha256').update(buf).digest('hex');
console.log('sha256:', hash);

// Slicing a buffer shares the SAME underlying memory (no copy) -- mutating
// the slice mutates the original, unlike Array.prototype.slice.
const view = buf.subarray(0, 9);
view[0] = 0x58; // 'X'
console.log(buf.toString()); // "Xensitive payload" -- original was mutated
```

## Common Pitfalls / Gotchas

- Using `Buffer.allocUnsafe()` and returning/exposing it before fully overwriting every byte — leaks whatever stale memory content was there, a real security vulnerability.
- Assuming `buffer.slice()`/`subarray()` copies data like `Array.prototype.slice` — it returns a view over the *same* underlying memory; mutating the slice mutates the original buffer.
- Getting string length vs. byte length confused for non-ASCII text — `'🚀'.length` is 2 (UTF-16 code units) but `Buffer.byteLength('🚀')` is 4 (UTF-8 bytes); allocating a buffer sized by `.length` for multi-byte text truncates data.
- Converting a Buffer to a string with the wrong encoding (e.g., treating binary image data as `'utf8'`) silently produces mangled/replacement-character output instead of throwing an error.
- Concatenating many small Buffers with `+=`-style string coercion instead of `Buffer.concat([...])`, which is inefficient and can corrupt multi-byte sequences split across chunk boundaries.
- Using the deprecated `new Buffer()` constructor — removed usage is now `Buffer.from()`/`Buffer.alloc()`/`Buffer.allocUnsafe()`; `new Buffer()` had inconsistent behavior depending on argument type and known security issues.
- Comparing buffers with `===` instead of `Buffer.compare()`/`.equals()` — object identity comparison doesn't compare byte content.

## Interview Questions & Answers

**Q: What is a Buffer in Node.js, and how does it relate to Uint8Array?**
A: A Buffer is Node's class for handling raw, fixed-length binary data, allocated outside the standard V8 JS heap for efficient interop with I/O operations. Since Node v4+, `Buffer` is implemented as a subclass of `Uint8Array`, so it's a valid TypedArray usable anywhere one is expected, while adding Node-specific convenience methods like `.toString(encoding)`.

**Q: What's the difference between `Buffer.alloc()` and `Buffer.allocUnsafe()`?**
A: `Buffer.alloc(size)` allocates and zero-fills the memory, so you always get a clean buffer of zero bytes. `Buffer.allocUnsafe(size)` skips zero-filling for performance, meaning the returned buffer may contain leftover data from previous memory usage — it must be fully overwritten before its contents are read or exposed, or you risk leaking stale/sensitive data.

**Q: Why might a UTF-8 string's `.length` not match its `Buffer.byteLength`?**
A: `.length` on a JS string counts UTF-16 code units, while `Buffer.byteLength(str)` counts actual UTF-8 encoded bytes. Characters outside the Basic Multilingual Plane (like many emoji) take 2 UTF-16 code units but 4 UTF-8 bytes, and even BMP non-ASCII characters (like accented letters) often take more bytes than code units — so sizing a buffer using `.length` for such text under-allocates.

**Q: Does `buffer.slice(0, 10)` copy data?**
A: No. Like `TypedArray.prototype.subarray`, it returns a new Buffer object that's a *view* over the same underlying `ArrayBuffer` memory as the original — no copying occurs. Writing to the sliced buffer mutates the original buffer's bytes in that range too. To get an independent copy you need `Buffer.from(originalBuffer)` or `Buffer.concat`.

**Q: When would you choose to keep data as a Buffer/stream instead of converting to a string as early as possible?**
A: When processing large or performance-sensitive binary data — file contents, network payloads, hashing/encryption input — since string conversion has real CPU and memory cost, and many Node APIs (fs, net, crypto, zlib) operate natively on Buffers. Converting only decodes to text once the app actually needs to read/manipulate it as a string, avoiding unnecessary encode/decode round-trips.

## Related Topics

- [streams.md](./streams.md)
- [crypto.md](./crypto.md)
- [file-systems.md](./file-systems.md)
- [http.md](./http.md)
- [zlib.md](./zlib.md)
