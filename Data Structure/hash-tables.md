# Hash Tables

A hash table stores key-value pairs and gives average O(1) insert, lookup, and delete by using a **hash function** to convert a key into an array index (a "bucket"), instead of searching linearly or maintaining sorted order the way an array or BST would. The hash function must be deterministic (same key always maps to the same index) and should distribute keys as uniformly as possible across the available buckets — a poor hash function that clusters many keys into the same few buckets degrades performance toward O(n), because now every operation on a crowded bucket has to scan through many entries.

Because the number of possible keys vastly exceeds the number of buckets, **collisions** — two different keys hashing to the same bucket — are inevitable, and how a hash table resolves them defines its behavior. **Separate chaining** stores each bucket as a small list (or array) of all entries that hashed there, so a collision just means appending to that bucket's list; lookup then hashes to the right bucket and scans its (usually short) list. **Open addressing** instead stores every entry directly in the main array, and on a collision, probes forward (linearly, quadratically, or via a second hash function) to find the next open slot — this avoids the extra list-node overhead of chaining but requires careful handling of deletions (naively removing an entry can break the probe chain for later lookups).

The **load factor** — number of stored entries divided by number of buckets — is the key metric governing performance: as it climbs, collisions become more frequent and each bucket's average chain length grows, degrading operations from O(1) toward O(n). Hash tables counteract this by **resizing**: once load factor crosses a threshold (commonly ~0.75), the table allocates a larger backing array (typically double the capacity) and **rehashes** every existing entry into it (since the bucket index depends on capacity, old indices are no longer valid). This resize is O(n), but because doublings become exponentially rarer as the table grows, the amortized cost per insert stays O(1) — the same amortized argument used for dynamic array growth.

## Examples

```js
// A hash table using separate chaining for collision resolution.
class HashTable {
  constructor(capacity = 8) {
    this.capacity = capacity;
    this.size = 0;
    this.buckets = Array.from({ length: this.capacity }, () => []);
  }

  _hash(key) {
    const str = String(key);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % this.capacity; // simple polynomial hash
    }
    return hash;
  }

  set(key, value) {
    if (this.size / this.capacity >= 0.75) this._resize(); // keep load factor bounded
    const bucket = this.buckets[this._hash(key)];
    const existing = bucket.find(entry => entry[0] === key);
    if (existing) {
      existing[1] = value; // update in place
      return;
    }
    bucket.push([key, value]);
    this.size++;
  }

  get(key) {
    const bucket = this.buckets[this._hash(key)];
    const entry = bucket.find(e => e[0] === key);
    return entry ? entry[1] : undefined;
  }

  delete(key) {
    const bucket = this.buckets[this._hash(key)];
    const index = bucket.findIndex(e => e[0] === key);
    if (index === -1) return false;
    bucket.splice(index, 1);
    this.size--;
    return true;
  }

  _resize() {
    const oldBuckets = this.buckets;
    this.capacity *= 2;
    this.buckets = Array.from({ length: this.capacity }, () => []);
    this.size = 0;
    for (const bucket of oldBuckets) {
      for (const [key, value] of bucket) this.set(key, value); // rehash into new capacity
    }
  }
}
```

```js
// Using the hash table — collisions are handled transparently via chaining.
const table = new HashTable(4); // small capacity to force collisions quickly
table.set('name', 'Anil');
table.set('role', 'Engineer');
table.set('team', 'Platform'); // likely collides with an existing bucket at capacity 4

table.get('name');   // 'Anil'
table.get('missing'); // undefined
table.delete('role');
table.get('role');   // undefined
```

```js
// Demonstrating the resize trigger: load factor >= 0.75 doubles capacity and rehashes.
const small = new HashTable(4);
small.set('a', 1); // size=1, load factor 0.25
small.set('b', 2); // size=2, load factor 0.50
small.set('c', 3); // load factor would be 0.75 -> resize happens BEFORE insert, capacity becomes 8
console.log(small.capacity); // 8
console.log(small.get('a'), small.get('b'), small.get('c')); // 1 2 3 — all rehashed correctly
```

## Common Pitfalls / Gotchas

- Using a poor hash function (e.g., only using the first character of a string, or a constant) — this clusters keys into few buckets and degrades every operation toward O(n), defeating the point of a hash table.
- Forgetting to resize (or resizing too late) — an unbounded load factor means buckets grow long chains, silently degrading a supposedly O(1) hash table into an O(n) linked-list-per-bucket structure.
- Using a plain JS object (`{}`) as a hash map without considering that all keys become strings (numeric keys get coerced) and that prototype properties (`toString`, `constructor`, etc.) can collide with legitimate keys unless you use `Object.create(null)` or, better, a real `Map`.
- Assuming O(1) is a worst-case guarantee — it's an *average*-case guarantee assuming a reasonably uniform hash function; a pathological input (or a hash function an attacker can predict) can force worst-case O(n) behavior (this is the basis of hash-flooding denial-of-service attacks, which is why some languages randomize their hash seed per process).
- Not handling deletions correctly in open-addressing schemes — naively clearing a slot can break the probe chain for keys that were inserted after a collision at that slot, making them unreachable; open addressing typically needs a special "deleted" tombstone marker instead of a true empty marker.

## Interview Questions & Answers

**Q: What is a load factor, and why does a hash table resize based on it?**
A: Load factor is the number of stored entries divided by the number of buckets. As it rises, more keys collide into the same buckets, and each bucket's average chain length grows, degrading average lookup/insert/delete from O(1) toward O(n) since operations must scan a longer chain. Resizing (typically doubling capacity once load factor crosses ~0.75) keeps chains short and operations close to O(1) amortized, at the one-time cost of an O(n) rehash.

**Q: Compare separate chaining and open addressing for collision resolution.**
A: Separate chaining stores a small list per bucket, so collisions just mean appending to that list — simple to implement and degrades gracefully, but has extra memory overhead per entry (list/node pointers) and worse cache locality (chasing pointers instead of scanning contiguous memory). Open addressing stores every entry directly in the backing array and probes to the next open slot on collision — better cache locality and no per-entry pointer overhead, but requires careful tombstone handling on deletion and can suffer from "clustering" (probe sequences piling up) as load factor rises, generally requiring a lower load-factor threshold than chaining.

**Q: Why is average-case hash table lookup O(1) but worst-case O(n)?**
A: Average case assumes a reasonably uniform hash function spreads keys evenly across buckets, so each bucket holds roughly (load factor) entries — a small constant, hence O(1). Worst case occurs when many or all keys hash to the same bucket (a bad hash function, or an adversarial/pathological input set), collapsing the structure into effectively one long chain that must be scanned linearly — O(n).

**Q: Why might a resize operation itself be expensive, and how is the *amortized* cost still O(1) per insert?**
A: A single resize rehashes every existing entry into the new, larger backing array — O(n) for that one operation. But resizes happen at exponentially growing intervals (after 1, 2, 4, 8... entries if doubling), so if you sum the total rehashing work over n inserts and divide by n, the amortized cost per insert is still O(1) — the same argument used for dynamic array growth (see [arrays.md](./arrays.md)).

**Q: When would you prefer a balanced BST over a hash table, despite the BST's slower O(log n) operations?**
A: When you need operations a hash table fundamentally can't provide efficiently: retrieving keys in sorted order, range queries (all keys between X and Y), or finding the minimum/maximum/predecessor/successor of a key. A hash table's whole design trades away ordering information for O(1) lookup, so any of those would require a full O(n log n) sort of its contents, whereas a balanced BST supports them in O(log n) as a natural consequence of its ordering invariant.

## Related Topics

- [trees.md](./trees.md)
- [binary-search-trees.md](./binary-search-trees.md)
- [arrays.md](./arrays.md)
- [big-o-notation.md](./big-o-notation.md)
- [trie.md](./trie.md)
</content>
</invoke>
