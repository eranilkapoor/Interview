# Trie

A trie (pronounced "try," from re**trie**val, and also called a prefix tree) is a tree structure specialized for storing strings, where each edge represents one character and every root-to-node path spells out a prefix shared by all words that continue through it. Unlike a hash table, which treats each key as an opaque unit hashed independently, a trie exploits the internal structure of strings: words sharing a common prefix ("car", "card", "care", "careful") share the same path through the tree for that prefix, branching only where the words diverge. This shared-path structure is exactly what makes prefix-based queries — "does any word start with X?", "list every word starting with X" — efficient in a way a hash table fundamentally cannot support without scanning every entry.

Each node holds a collection of children (commonly a `Map` from character to child node, or a fixed-size array for a known alphabet) and a boolean flag marking whether a complete word ends at that node — this flag is essential and easy to forget, because without it there's no way to distinguish "car" being a stored word from "car" merely being a prefix of "card". Insertion walks (or creates) a path character by character and sets the flag `true` at the final node; search walks the same path and returns whether that flag is set at the end (not just whether the path exists — that's `startsWith`, a different, weaker check).

Both `insert` and `search` run in O(m) time, where m is the length of the word being processed — critically, this is **independent of how many other words are stored** in the trie, unlike a linear scan over a word list which is O(n·m). The tradeoff is space: a trie can use significantly more memory than a flat list or hash table of the same words, since every distinct prefix gets its own node (though shared prefixes reduce this compared to storing each word independently). Tries underlie autocomplete, spell-checkers, IP routing tables (longest-prefix matching), and T9-style predictive text.

## Examples

```js
// A trie node holds its children (character -> node) and whether a word ends here.
class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch);
    }
    node.isEndOfWord = true; // mark the END of this specific word, not just a prefix path
  }

  search(word) {
    const node = this._traverse(word);
    return node !== null && node.isEndOfWord; // path must exist AND end a real word
  }

  startsWith(prefix) {
    return this._traverse(prefix) !== null; // path existing is enough — no isEndOfWord check
  }

  _traverse(str) {
    let node = this.root;
    for (const ch of str) {
      if (!node.children.has(ch)) return null;
      node = node.children.get(ch);
    }
    return node;
  }
}
```

```js
// Demonstrating why isEndOfWord matters: "car" is a stored word AND a prefix of "card".
const trie = new Trie();
trie.insert('car');
trie.insert('card');
trie.insert('care');

trie.search('car');       // true  — "car" was explicitly inserted, isEndOfWord=true at that node
trie.search('ca');        // false — "ca" is only a prefix (path exists, but isEndOfWord=false)
trie.startsWith('ca');    // true  — the path for "ca" exists, regardless of isEndOfWord
trie.startsWith('care');  // true
trie.search('cart');      // false — no path exists for "cart" at all
```

```js
// Autocomplete: given a prefix, find every stored word that starts with it, via a
// DFS from the prefix's ending node, collecting every node with isEndOfWord === true.
function autocomplete(trie, prefix) {
  const startNode = trie._traverse(prefix);
  if (!startNode) return []; // no words share this prefix at all

  const results = [];
  function collect(node, currentWord) {
    if (node.isEndOfWord) results.push(currentWord);
    for (const [ch, child] of node.children) {
      collect(child, currentWord + ch);
    }
  }
  collect(startNode, prefix);
  return results;
}

autocomplete(trie, 'car'); // ['car', 'card', 'care']
```

## Common Pitfalls / Gotchas

- Forgetting the `isEndOfWord` flag (or forgetting to check it in `search`) — without it, `search` degenerates into `startsWith`, incorrectly reporting that any inserted prefix is itself a complete stored word.
- Confusing `search` (must end exactly at a complete word) with `startsWith` (path just needs to exist) — they look almost identical in code but answer different questions, and mixing them up is a common bug.
- Underestimating memory usage — a trie storing many long words with little shared structure can use substantially more memory than a flat array or hash set of the same words, since every distinct character position potentially gets its own node.
- Using a fixed-size array of children (e.g., size 26 for lowercase English letters) without accounting for the actual character set needed (uppercase, digits, Unicode) — a `Map` is more flexible at a small performance cost.
- Forgetting to handle deletion correctly — simply clearing `isEndOfWord` on the target node isn't enough if you also want to prune now-unused nodes; naive deletion can leave orphaned branches if not implemented carefully (walk back up removing nodes with no children and no `isEndOfWord`, stopping as soon as a node still has other children or ends another word).

## Interview Questions & Answers

**Q: Why is a trie faster than a hash table for prefix-based lookups (e.g., autocomplete)?**
A: A hash table gives O(1) average lookup for an *exact* key, but hashing destroys any relationship between similar keys — there's no way to find "all keys starting with X" without scanning every entry, O(n·m) in the worst case. A trie stores keys along shared root-to-node paths by construction, so walking to the end of a prefix is O(m) (m = prefix length), and every word sharing that prefix lives in the subtree rooted there — a DFS from that node retrieves them all without touching unrelated entries.

**Q: What's the time and space complexity of trie insert and search?**
A: Both are O(m), where m is the length of the word — independent of how many other words are already stored, unlike scanning a list which would be O(n·m). Space is O(ALPHABET_SIZE × N × M) in the worst case (N words of average length M with no shared prefixes at all), but in practice shared prefixes reduce this significantly — the more words share common prefixes, the more space-efficient a trie becomes relative to storing them independently.

**Q: What's the difference between `search` and `startsWith` in a trie implementation, and why does the difference matter?**
A: `search(word)` requires both that a path exists for every character of `word` AND that the final node's `isEndOfWord` flag is set — i.e., `word` was itself explicitly inserted as a complete word. `startsWith(prefix)` only requires that the path exists — it doesn't care whether `prefix` was ever inserted as a complete word itself, just that some stored word begins with it. Confusing the two produces wrong answers: e.g., after inserting only "card", `search('car')` should be `false` (car was never inserted) while `startsWith('car')` should be `true`.

**Q: How would you implement deletion of a word from a trie?**
A: Recursively walk down to the word's final node and clear its `isEndOfWord` flag. Then, walking back up (unwinding the recursion), delete each node from its parent's children map if that node has no children of its own AND doesn't mark the end of some other word — stop pruning as soon as you hit a node that still has other children or is itself the end of a different word, since removing it would incorrectly delete unrelated stored words that share that prefix.

**Q: When would you choose a trie over a hash set purely for "does this exact word exist" lookups (no prefix queries needed)?**
A: Rarely — if you never need prefix operations, a hash set's O(1) average lookup with lower memory overhead per entry usually wins outright. A trie's advantages (shared-prefix compression, ordered/prefix traversal) are specifically about exploiting string structure; without needing that structure, its extra per-character node overhead is pure cost with no corresponding benefit.

## Related Topics

- [hash-tables.md](./hash-tables.md)
- [trees.md](./trees.md)
- [recursion.md](./recursion.md)
- [big-o-notation.md](./big-o-notation.md)
</content>
</invoke>
