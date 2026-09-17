# Crypto

The `node:crypto` module wraps OpenSSL to provide cryptographic primitives directly in Node.js: hashing, HMAC message authentication, symmetric and asymmetric encryption, digital signatures, secure random number generation, and key derivation for password storage. Getting the right function for the right job matters a lot here — this is one of the areas where using a superficially similar but wrong API (e.g., `Math.random()` instead of `crypto.randomBytes()`, or plain SHA-256 instead of a proper password-hashing KDF) creates real security vulnerabilities, so interviewers often probe specifically for these distinctions.

`crypto.createHash(algorithm)` produces a one-way, fixed-size digest of input data (e.g., `'sha256'`) — useful for checksums, content-addressing, and detecting tampering with data whose integrity (not secrecy) matters, but it is deliberately fast, which makes it *unsuitable* for hashing passwords: an attacker with a stolen hash database can brute-force fast hashes at billions of attempts per second on commodity GPUs. For message authentication (verifying data came from someone who holds a shared secret and wasn't altered), `crypto.createHmac(algorithm, secretKey)` combines a hash function with a secret key so that only someone who knows the key can produce a valid HMAC — this is what's typically used to verify webhook payload signatures.

For symmetric encryption (same key encrypts and decrypts), the modern, correct API is `crypto.createCipheriv(algorithm, key, iv)` / `crypto.createDecipheriv(algorithm, key, iv)` — the `iv` (initialization vector) is mandatory here, and that's the point: the older `crypto.createCipher()`/`createDecipher()` (deprecated since Node 10, removed guidance recommends never using it) derived the key and IV internally from a password using a weak, predictable scheme and used no explicit IV, which made ciphertexts produced from the same key deterministic and vulnerable to several classes of attack. With `createCipheriv`, you must generate a fresh, random, unpredictable IV per encryption operation (`crypto.randomBytes(16)` for AES) and typically use an authenticated mode like AES-256-GCM, which additionally produces an authentication tag (`cipher.getAuthTag()`) that lets the decrypting side detect if the ciphertext was tampered with.

For password storage, you never hash a password directly with SHA-256/SHA-512 — you use a deliberately slow, memory-hard key derivation function designed to resist brute-forcing: `crypto.scrypt` (built into Node core, memory-hard, generally recommended by default), `crypto.pbkdf2` (older, CPU-hard but not memory-hard, configurable iteration count), or the widely used userland library `bcrypt` (has its own adaptive cost factor and built-in salt handling). All of these require a unique, random salt per password (`crypto.randomBytes`) to defeat precomputed rainbow-table attacks, and their whole design goal is to make each individual guess expensive, unlike a general-purpose hash. Finally, `crypto.randomBytes(size)` (or the newer `crypto.randomUUID()` for generating UUIDs, and Web Crypto's `crypto.webcrypto.getRandomValues()`) provides cryptographically secure randomness suitable for keys, IVs, tokens, and salts — `Math.random()` is not cryptographically secure and must never be used for anything security-sensitive, since its output is predictable given enough samples.

## Examples

```js
// Hashing for integrity (NOT for passwords) + HMAC for authenticated messages
import { createHash, createHmac } from 'node:crypto';

const fileContents = 'some file contents to checksum';
const checksum = createHash('sha256').update(fileContents).digest('hex');
console.log('SHA-256 checksum:', checksum);

// HMAC proves the message came from someone holding the shared secret and wasn't altered
// (e.g. verifying a webhook signature from a payment provider)
const webhookSecret = 'shared-secret-from-provider';
const payload = JSON.stringify({ event: 'payment.succeeded', amount: 4999 });
const signature = createHmac('sha256', webhookSecret).update(payload).digest('hex');
console.log('HMAC signature:', signature);
```

```js
// Symmetric encryption with AES-256-GCM using the modern createCipheriv/createDecipheriv API
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const key = randomBytes(32); // 256-bit key — store/derive this securely, never hardcode
const iv = randomBytes(12);  // 12-byte IV is recommended for GCM; MUST be unique per encryption

function encrypt(plaintext) {
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // detects tampering on decrypt
  return { ciphertext: ciphertext.toString('hex'), authTag: authTag.toString('hex'), iv: iv.toString('hex') };
}

function decrypt({ ciphertext, authTag, iv }) {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final(), // throws if the auth tag doesn't match — tampering detected
  ]);
  return plaintext.toString('utf8');
}

const encrypted = encrypt('sensitive account data');
console.log(decrypt(encrypted)); // "sensitive account data"
```

```js
// Password hashing with scrypt — slow and memory-hard by design, unlike createHash
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16); // unique salt per password, defeats rainbow tables
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [saltHex, keyHex] = storedHash.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const storedKey = Buffer.from(keyHex, 'hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  // timingSafeEqual avoids leaking info via response-time differences (timing attacks)
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

const stored = await hashPassword('correct horse battery staple');
console.log(await verifyPassword('correct horse battery staple', stored)); // true
console.log(await verifyPassword('wrong guess', stored)); // false
```

## Common Pitfalls / Gotchas

- Using `createHash('sha256')` (or any fast general-purpose hash) directly on passwords — fast hashes are brute-forceable at massive scale; always use `scrypt`, `pbkdf2`, or `bcrypt` for passwords.
- Using the deprecated `crypto.createCipher()`/`createDecipher()` — they derive a weak key/IV internally from a password with no explicit IV, producing deterministic, crackable output; always use `createCipheriv`/`createDecipheriv` with an explicit random IV.
- Reusing the same IV (initialization vector) across multiple encryptions with the same key — for many modes (especially GCM/CTR) this catastrophically breaks confidentiality; generate a fresh random IV every time.
- Using `Math.random()` to generate keys, tokens, IVs, or salts — it's not cryptographically secure and its output can be predicted; always use `crypto.randomBytes()` or `crypto.randomUUID()`.
- Comparing secrets (password hashes, HMAC signatures, tokens) with `===` or `Buffer.equals()` instead of `crypto.timingSafeEqual()` — naive comparison short-circuits on the first differing byte, leaking timing information an attacker can exploit to guess the value byte-by-byte.
- Hardcoding encryption keys or secrets directly in source code instead of loading them from environment variables or a secrets manager.
- Forgetting to store and use the GCM authentication tag (`getAuthTag()`/`setAuthTag()`) — without it you lose tamper detection and effectively get unauthenticated encryption.
- Assuming encryption alone provides integrity — a non-authenticated mode (like plain AES-CBC without an HMAC) can be silently modified in transit; prefer an authenticated mode like GCM, or add an HMAC over the ciphertext.

## Interview Questions & Answers

**Q: Why shouldn't you hash passwords with `crypto.createHash('sha256')`?**
A: `createHash` is designed to be fast, which is exactly the wrong property for password storage — a fast hash lets an attacker who obtains the hash database try billions of guesses per second on cheap hardware (especially GPUs). Password storage needs a deliberately slow, memory-hard key derivation function like `scrypt` or `pbkdf2` (or bcrypt), which makes each individual guess computationally expensive and thus brute-forcing infeasible at scale, combined with a unique random salt per password to defeat precomputed rainbow-table attacks.

**Q: What's wrong with `crypto.createCipher()`, and what should you use instead?**
A: `createCipher()` (and `createDecipher()`) derive both the encryption key and the IV internally from a single password string using a weak, deterministic, undocumented-strength scheme, and don't take an explicit IV. That means encrypting the same plaintext with the same password always produces the same ciphertext, leaking patterns, and the overall construction is considered cryptographically weak. It's deprecated; use `createCipheriv`/`createDecipheriv` instead, supplying your own securely generated key and a fresh random IV (via `crypto.randomBytes`) for every encryption operation, ideally with an authenticated mode like AES-256-GCM.

**Q: What is an HMAC and what is it used for?**
A: An HMAC (hash-based message authentication code) combines a cryptographic hash function with a secret key so that only someone who possesses the key can generate a valid HMAC for a given message, and any modification to the message invalidates it. It's used to verify both the authenticity (who sent it) and integrity (wasn't altered) of a message — a very common real-world use is verifying webhook signatures, where a payment or SaaS provider signs the request body with a shared secret and you recompute the HMAC on your end to confirm it matches before trusting the payload.

**Q: Why use `crypto.randomBytes()` instead of `Math.random()` for generating a token or key?**
A: `Math.random()` is backed by a non-cryptographic pseudo-random number generator; its internal state can, in principle, be inferred from a sequence of outputs, making its future output predictable. `crypto.randomBytes()` uses the OS's cryptographically secure random number generator (CSPRNG), which is specifically designed to be unpredictable even to an attacker who has observed prior output — a requirement for anything security-sensitive like session tokens, encryption keys, or IVs.

**Q: What does `crypto.timingSafeEqual()` protect against, and when would you use it?**
A: It protects against timing attacks: a naive `===` or loop-based comparison of two secrets (e.g., an HMAC signature or a password hash) typically returns as soon as it finds the first mismatched byte, so the time the comparison takes leaks information about how many leading bytes were correct. An attacker measuring response times over many attempts can exploit that to reconstruct the secret byte by byte. `timingSafeEqual()` always compares in constant time regardless of where a mismatch occurs, so you'd use it whenever comparing a computed secret (signature, MAC, hash) against an expected value, such as validating a webhook signature or a password digest.

## Related Topics

- [security.md](./security.md)
- [buffers.md](./buffers.md)
- [tls-ssl.md](./tls-ssl.md)
- [https.md](./https.md)
- [util.md](./util.md)
