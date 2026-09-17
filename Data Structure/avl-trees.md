# AVL Trees

An AVL tree (named for inventors Adelson-Velsky and Landis) is a self-balancing binary search tree that maintains the BST ordering property while additionally enforcing a strict balance invariant: for every node, the heights of its left and right subtrees differ by at most 1. This measurement — left subtree height minus right subtree height — is called the **balance factor**, and it must always be -1, 0, or 1 for every node in a valid AVL tree; a balance factor of ±2 signals a violation that must be fixed immediately via rotation. This is the direct fix for a plain BST's worst-case failure mode: inserting already-sorted data into an unbalanced BST degrades it into a linked list (height O(n)), while an AVL tree's balance invariant *guarantees* height stays O(log n) regardless of insertion order.

Maintaining that invariant requires **rotations** — local restructurings of a few nodes that fix a balance violation without breaking the BST ordering property. There are four cases, determined by where the newly inserted node created the imbalance relative to the unbalanced node: **LL** (left-left: imbalance in the left subtree's left subtree) is fixed with a single right rotation; **RR** (right-right) is fixed with a single left rotation; **LR** (left-right: imbalance in the left subtree's *right* subtree) requires a left rotation on the left child first, then a right rotation on the node itself; **RL** (right-left) is the mirror — a right rotation on the right child first, then a left rotation on the node. The "L/R" naming describes the shape of the imbalance, and the two-step LR/RL cases are the ones most often botched in interviews because it's easy to rotate in the wrong order or at the wrong node.

Every insertion (and deletion) potentially triggers rotations as the fix propagates back up the tree — after inserting, you walk back up updating each ancestor's height and checking its balance factor, rotating as soon as you find a violation. This keeps insert, search, and delete all at guaranteed O(log n), trading a small constant-factor cost (occasional rotations, and height bookkeeping on every insert) for the *guarantee* that a plain BST doesn't provide. AVL trees are more rigidly balanced than the other common self-balancing BST, the red-black tree — AVL enforces a tighter height bound (better for read-heavy workloads with faster lookups) at the cost of more frequent rotations on writes, while red-black trees tolerate looser balance for cheaper insertions/deletions. This is why database indexes and read-heavy in-memory structures sometimes favor AVL, while general-purpose language library maps (e.g., C++'s `std::map`, Java's `TreeMap`) typically use red-black trees.

## Examples

```js
// AVL node tracks its own height so balance factor can be computed in O(1) per node.
class AVLNode {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
    this.height = 1; // height of a leaf is 1
  }
}

function height(node) {
  return node ? node.height : 0;
}

function balanceFactor(node) {
  return node ? height(node.left) - height(node.right) : 0;
}

function updateHeight(node) {
  node.height = 1 + Math.max(height(node.left), height(node.right));
}
```

```js
// The two single rotations. Each takes O(1) — just re-wiring three pointers
// and recomputing two heights (the rotated node and its new parent).
function rotateRight(y) {
  const x = y.left;
  const T2 = x.right;

  x.right = y;   // y becomes x's right child
  y.left = T2;   // y adopts x's old right subtree as its new left subtree

  updateHeight(y); // update y FIRST — x's height depends on y's now-current height
  updateHeight(x);
  return x; // x is the new subtree root
}

function rotateLeft(x) {
  const y = x.right;
  const T2 = y.left;

  y.left = x;
  x.right = T2;

  updateHeight(x);
  updateHeight(y);
  return y; // y is the new subtree root
}
```

```js
// Insert with rebalancing: standard BST insert, then walk back up fixing any
// balance-factor violation (|balance| > 1) with the appropriate rotation case.
function insert(node, value) {
  if (!node) return new AVLNode(value);

  if (value < node.value) node.left = insert(node.left, value);
  else if (value > node.value) node.right = insert(node.right, value);
  else return node; // no duplicates

  updateHeight(node);
  const balance = balanceFactor(node);

  // LL case: left-left heavy — single right rotation
  if (balance > 1 && value < node.left.value) return rotateRight(node);

  // RR case: right-right heavy — single left rotation
  if (balance < -1 && value > node.right.value) return rotateLeft(node);

  // LR case: left-right heavy — rotate left child left, THEN rotate node right
  if (balance > 1 && value > node.left.value) {
    node.left = rotateLeft(node.left);
    return rotateRight(node);
  }

  // RL case: right-left heavy — rotate right child right, THEN rotate node left
  if (balance < -1 && value < node.right.value) {
    node.right = rotateRight(node.right);
    return rotateLeft(node);
  }

  return node; // already balanced
}

// Example: inserting 10, 20, 30 in order into an empty AVL tree.
let root = null;
root = insert(root, 10);
root = insert(root, 20); // still balanced: root=10 (balance -1)
root = insert(root, 30); // root=10 has balance -2 (RR case) -> rotateLeft(10) -> root becomes 20
console.log(root.value); // 20 — a plain BST would instead have degenerated into a 3-deep chain
```

## Common Pitfalls / Gotchas

- Forgetting to call `updateHeight` on both nodes involved in a rotation, or updating them in the wrong order — the rotated-in node's height must be recomputed *before* its new parent's, since the parent's height depends on it.
- Checking the balance factor before updating the current node's own height after a recursive insert — the height must be refreshed first, or the balance-factor calculation uses stale data.
- Mixing up the LR/RL two-step rotations — e.g., applying a single right rotation for what's actually an LR case (imbalance in the left child's *right* subtree) produces a tree that's still unbalanced or violates BST ordering; the child must be rotated first to convert LR into a plain LL shape before rotating the node itself.
- Assuming AVL trees are "just balanced BSTs" without appreciating the cost — every insert/delete potentially cascades rotations back up to the root, giving AVL trees a higher constant-factor write cost than an unbalanced BST or a more loosely-balanced red-black tree.
- Forgetting that deletion, not just insertion, can also trigger cascading rebalancing — and unlike insertion (which needs at most one or two rotations to fully rebalance), a single deletion can require rotations at multiple ancestors all the way up to the root.

## Interview Questions & Answers

**Q: What is the balance factor, and what values are allowed in a valid AVL tree?**
A: Balance factor is (height of left subtree) − (height of right subtree) for a given node. A valid AVL tree requires every node's balance factor to be −1, 0, or 1; a magnitude of 2 or more means the subtree rooted there is out of balance and needs a rotation to fix.

**Q: Why are there four rotation cases (LL, RR, LR, RL) instead of just two?**
A: A single rotation (left or right) only correctly fixes a "straight-line" imbalance — a chain leaning entirely one direction (LL: left child's left subtree is too tall; RR: the mirror). When the imbalance instead "zig-zags" — the left child's *right* subtree is too tall (LR), or the right child's *left* subtree is too tall (RL) — a single rotation at the unbalanced node doesn't fix it (it just moves the imbalance elsewhere); you first need to rotate the child in the opposite direction to straighten the zig-zag into a straight line, and only then rotate the node itself.

**Q: What's the time complexity of insert, search, and delete in an AVL tree, and how does that compare to a plain (unbalanced) BST?**
A: All three are guaranteed O(log n) in an AVL tree, because the balance invariant caps the tree's height at O(log n) regardless of insertion order. A plain BST has the same O(log n) *average* case but O(n) *worst* case — inserting already-sorted data degenerates it into a linked list, since there's nothing to prevent every new node from becoming the deepest right (or left) child.

**Q: AVL trees vs. red-black trees — what's the practical tradeoff?**
A: AVL trees enforce a tighter balance (height difference ≤ 1 at every node) which keeps the tree closer to minimal height, giving faster lookups, but requires more frequent and sometimes cascading rotations on insert/delete. Red-black trees allow looser balance (a weaker set of coloring invariants that still bound height to O(log n), just with a larger constant), meaning fewer rotations on average for writes but a somewhat taller tree and slightly slower reads. This is why AVL suits read-heavy workloads (e.g., database indexes with far more lookups than modifications) while red-black trees suit workloads with more balanced read/write ratios (many general-purpose library map/set implementations).

**Q: Walk through what happens when you insert 10, then 20, then 30 into an empty AVL tree.**
A: Insert 10 — becomes the root, balance factor 0. Insert 20 as 10's right child — 10's balance factor becomes −1 (right subtree height 1, left 0), still valid, no rotation. Insert 30 as 20's right child — now 10's right subtree has height 2 while its left has height 0, giving 10 a balance factor of −2 (RR case, since 30 > 20, the imbalance is in the right child's right subtree). A single left rotation at 10 fixes it: 20 becomes the new root, with 10 as its left child and 30 as its right child — now every node has balance factor 0.

## Related Topics

- [binary-search-trees.md](./binary-search-trees.md)
- [trees.md](./trees.md)
- [big-o-notation.md](./big-o-notation.md)
- [recursion.md](./recursion.md)
</content>
</invoke>
