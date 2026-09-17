# Trees

A tree is a hierarchical, non-linear data structure made of nodes connected by edges, with exactly one path between any two nodes and no cycles. One node is designated the **root** (the only node with no parent); every other node has exactly one parent and zero or more **children**. A node with no children is a **leaf**. The **depth** of a node is the number of edges from the root to that node; the **height** of a node is the number of edges on the longest downward path from that node to a leaf (so the height of the tree as a whole is the height of the root). A **subtree** rooted at any node is itself a valid tree consisting of that node and all of its descendants — this self-similar structure is exactly why tree algorithms are naturally recursive: an operation on a tree is usually "do something at this node, then recurse into its subtrees."

A **general tree** places no limit on how many children a node may have. A **binary tree** restricts every node to at most two children, conventionally called `left` and `right` — this restriction is what makes binary trees analyzable with clean array-index math (as in a heap) and what makes binary search trees possible (see [binary-search-trees.md](./binary-search-trees.md)). A binary tree is **complete** if every level is fully filled except possibly the last, which fills left to right with no gaps; it is **balanced** if the height difference between left and right subtrees at every node is bounded by a constant (see [avl-trees.md](./avl-trees.md)). These shape properties matter because most tree operations cost O(height) — a balanced tree with n nodes has height O(log n), while a degenerate tree (effectively a linked list) has height O(n).

Traversal is the general term for visiting every node exactly once, and the order in which nodes are visited relative to their children defines the four classic traversal strategies. **Preorder** (node, left, right) visits a node before its subtrees — useful for copying a tree or producing a prefix expression. **Inorder** (left, node, right) visits a node between its subtrees — on a binary search tree specifically, inorder traversal always yields values in sorted order, which is one of the most important facts to know cold in an interview. **Postorder** (left, right, node) visits a node after its subtrees — useful when children must be processed before the parent, such as safely deleting a tree bottom-up or evaluating a postfix expression. All three are naturally implemented with recursion (or an explicit stack) because they follow the depth-first shape of the recursive subtree definition. **Level-order** traversal (breadth-first search) instead visits nodes level by level, top to bottom, left to right — it cannot be expressed as simple recursion in the same way and instead needs an explicit FIFO queue to track which nodes to visit next.

## Examples

```js
class TreeNode {
  constructor(value, left = null, right = null) {
    this.value = value;
    this.left = left;
    this.right = right;
  }
}

// Recursive depth-first traversals — each visits n nodes exactly once.
// Time: O(n). Space: O(h) for the call stack, where h is tree height
// (O(log n) balanced, O(n) worst case on a degenerate/skewed tree).
function preorder(node, out = []) {
  if (!node) return out;           // base case: empty subtree contributes nothing
  out.push(node.value);            // visit node...
  preorder(node.left, out);        // ...then left subtree...
  preorder(node.right, out);       // ...then right subtree
  return out;
}

function inorder(node, out = []) {
  if (!node) return out;
  inorder(node.left, out);         // left subtree first
  out.push(node.value);            // then this node
  inorder(node.right, out);        // then right subtree
  return out;
}

function postorder(node, out = []) {
  if (!node) return out;
  postorder(node.left, out);
  postorder(node.right, out);
  out.push(node.value);            // node visited last — children fully processed first
  return out;
}

const tree = new TreeNode(4,
  new TreeNode(2, new TreeNode(1), new TreeNode(3)),
  new TreeNode(6, new TreeNode(5), new TreeNode(7))
);
console.log(preorder(tree));   // [4, 2, 1, 3, 6, 5, 7]
console.log(inorder(tree));    // [1, 2, 3, 4, 5, 6, 7] — sorted, because this is a valid BST
console.log(postorder(tree));  // [1, 3, 2, 5, 7, 6, 4]
```

```js
// Iterative level-order traversal (BFS) using an explicit queue.
// Time: O(n) — every node enqueued and dequeued exactly once.
// Space: O(w) where w is the tree's maximum width (worst case O(n)).
function levelOrder(root) {
  if (!root) return [];
  const result = [];
  const queue = [root];         // FIFO: shift() from front, push() to back
  let head = 0;                 // index-based "shift" avoids O(n) Array.shift() cost

  while (head < queue.length) {
    const node = queue[head++];
    result.push(node.value);
    if (node.left) queue.push(node.left);
    if (node.right) queue.push(node.right);
  }
  return result;
}

console.log(levelOrder(tree)); // [4, 2, 6, 1, 3, 5, 7]
```

```js
// Level-order grouped by depth — a common variant ("binary tree level order II")
// that processes one full level at a time using the queue's length as a snapshot.
function levelOrderByDepth(root) {
  if (!root) return [];
  const levels = [];
  let queue = [root];
  while (queue.length) {
    const size = queue.length;      // freeze this level's size before mutating queue
    const level = [];
    const next = [];
    for (let i = 0; i < size; i++) {
      const node = queue[i];
      level.push(node.value);
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }
    levels.push(level);
    queue = next;
  }
  return levels;
}

console.log(levelOrderByDepth(tree)); // [[4], [2, 6], [1, 3, 5, 7]]
```

## Common Pitfalls / Gotchas

- Forgetting the base case (`if (!node) return`) in recursive traversals — the recursion needs an explicit stop condition at `null` children, otherwise it throws on leaf nodes' non-existent children.
- Confusing preorder/inorder/postorder by their names alone — the position of "visit the node" (before, between, or after recursing into children) is the only thing that distinguishes them; memorize the pattern, not the label.
- Using `Array.prototype.shift()` for a BFS queue on large trees — it's O(n) per call because it re-indexes the whole array, silently turning an O(n) traversal into O(n²). Use an index pointer or a real queue/deque instead.
- Assuming inorder traversal produces sorted output for *any* binary tree — that guarantee only holds for a valid binary search tree, not trees in general.
- Conflating "height" and "depth" — depth is measured from the root down to a node; height is measured from a node up to its deepest leaf. The height of the whole tree equals the depth of its deepest leaf.

## Interview Questions & Answers

**Q: What's the difference between a binary tree and a binary search tree?**
A: A binary tree only constrains node degree — at most two children per node, with no ordering requirement. A binary search tree adds an ordering invariant on top of that shape: for every node, all values in its left subtree are smaller and all values in its right subtree are larger. Every BST is a binary tree, but not every binary tree is a BST.

**Q: Why does inorder traversal of a BST produce sorted output, but not for an arbitrary binary tree?**
A: Inorder visits left subtree, then the node, then right subtree. In a BST, the left subtree is guaranteed to hold only smaller values and the right subtree only larger values at every level of recursion, so visiting left-node-right at every node necessarily emits values in ascending order. An arbitrary binary tree has no such ordering guarantee between a node and its children, so inorder traversal just produces some tree-shape-dependent sequence with no numerical meaning.

**Q: How would you compute the height of a binary tree?**
A: Recursively: the height of an empty tree is -1 (or 0, depending on convention — state which you're using), and the height of any other node is `1 + max(height(left), height(right))`. This is a postorder-shaped computation since you need both children's heights before you can compute the current node's. Time is O(n), space is O(h) for the recursion stack.
```js
function height(node) {
  if (!node) return -1;
  return 1 + Math.max(height(node.left), height(node.right));
}
```

**Q: Given a binary tree, how would you check if it's height-balanced (i.e., could pass as an AVL tree)?**
A: Naively computing height at every node from scratch is O(n²) in the worst case. The efficient approach computes height and checks balance in the same postorder pass, returning a sentinel (e.g., `-1`) the moment an imbalance is found anywhere below, so the recursion can short-circuit back up without doing redundant work — this gets it down to O(n) overall, checking each of the n nodes' subtree heights exactly once.

**Q: How would you serialize and deserialize a binary tree (e.g., to store it or send it over a network)?**
A: Preorder traversal is the standard choice because visiting the node before its children makes reconstruction straightforward: serialize by writing each node's value in preorder, using an explicit sentinel (like `null` or `#`) for missing children so the shape is recoverable; deserialize by consuming that same sequence in order, recursively rebuilding left before right exactly as it was written. Both directions are O(n) time and space.

## Related Topics

- [binary-search-trees.md](./binary-search-trees.md)
- [avl-trees.md](./avl-trees.md)
- [heaps.md](./heaps.md)
- [trie.md](./trie.md)
- [recursion.md](./recursion.md)
- [queues.md](./queues.md)
- [big-o-notation.md](./big-o-notation.md)
