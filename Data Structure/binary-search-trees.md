# Binary Search Trees

A binary search tree (BST) is a binary tree that maintains one ordering invariant at every single node: every value in that node's left subtree is strictly less than the node's own value, and every value in its right subtree is strictly greater (duplicate handling is a design choice — commonly disallowed, or consistently routed to one side). This invariant holds recursively at every node, not just the root, which is what makes operations like search behave like binary search on a sorted array: at each node you compare the target against the current value and eliminate an entire subtree from consideration, rather than scanning linearly.

Search, insert, and delete all follow the same root-to-leaf descent pattern driven by the invariant: go left if the target is smaller, right if it's larger, and stop when you find a match or fall off the tree (hit `null`). Because each comparison discards one whole subtree, all three operations cost O(h) where h is the tree's height — and h is O(log n) *only if the tree stays reasonably balanced*. A BST built by inserting already-sorted data (e.g., 1, 2, 3, 4, 5 in order) degenerates into a structure that is really just a linked list, with height O(n) and every operation correspondingly degrading to O(n). This is precisely the problem self-balancing variants like AVL trees and red-black trees exist to solve — they preserve the BST invariant while actively bounding the height to O(log n) (see [avl-trees.md](./avl-trees.md)).

Deletion is the operation most often gotten wrong, because it has three distinct cases depending on the node being removed. Deleting a **leaf** node is trivial — just detach it from its parent. Deleting a node with **one child** just splices that child up into the deleted node's position. Deleting a node with **two children** is the subtle case: you cannot simply remove it, since that would disconnect two subtrees. Instead, you find either the **inorder successor** (the smallest value in the right subtree — reached by going right once, then left as far as possible) or the **inorder predecessor** (the largest value in the left subtree), copy that value into the node being "deleted," and then recursively delete the successor/predecessor from its original position (which is guaranteed to fall into the leaf or one-child case, since the smallest node in a subtree can never have a left child).

## Examples

```js
class BSTNode {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

class BinarySearchTree {
  constructor() {
    this.root = null;
  }

  // O(h) average O(log n), worst case O(n) on a degenerate tree. Space O(h) — recursion stack.
  insert(value) {
    this.root = this._insert(this.root, value);
    return this;
  }

  _insert(node, value) {
    if (!node) return new BSTNode(value);         // found the empty slot — place it here
    if (value < node.value) node.left = this._insert(node.left, value);
    else if (value > node.value) node.right = this._insert(node.right, value);
    // equal values are ignored here (no duplicates); adjust policy as needed
    return node;
  }

  // O(h) average O(log n), worst case O(n).
  search(value) {
    let node = this.root;
    while (node) {
      if (value === node.value) return true;
      node = value < node.value ? node.left : node.right;
    }
    return false;
  }

  // O(h) average O(log n), worst case O(n).
  delete(value) {
    this.root = this._delete(this.root, value);
  }

  _delete(node, value) {
    if (!node) return null;                        // value not found — nothing to do

    if (value < node.value) {
      node.left = this._delete(node.left, value);
    } else if (value > node.value) {
      node.right = this._delete(node.right, value);
    } else {
      // Found the node to delete.
      if (!node.left && !node.right) return null;              // Case 1: leaf
      if (!node.left) return node.right;                        // Case 2: only right child
      if (!node.right) return node.left;                        // Case 2: only left child

      // Case 3: two children — replace value with inorder successor
      // (smallest value in the right subtree), then delete that successor.
      let successor = node.right;
      while (successor.left) successor = successor.left;
      node.value = successor.value;
      node.right = this._delete(node.right, successor.value);
    }
    return node;
  }

  inorder(node = this.root, out = []) {
    if (!node) return out;
    this.inorder(node.left, out);
    out.push(node.value);
    this.inorder(node.right, out);
    return out;
  }
}

const bst = new BinarySearchTree();
[8, 3, 10, 1, 6, 14, 4, 7, 13].forEach(v => bst.insert(v));
console.log(bst.inorder());   // [1, 3, 4, 6, 7, 8, 10, 13, 14] — always sorted
console.log(bst.search(6));   // true
bst.delete(3);                // two-child case: 3 replaced by inorder successor 4
console.log(bst.inorder());   // [1, 4, 6, 7, 8, 10, 13, 14]
```

```js
// Classic interview question: validate whether a binary tree satisfies the BST invariant.
// A common WRONG approach only compares each node to its immediate children — that misses
// violations further down (e.g., a right-subtree grandchild smaller than the root). The
// correct approach threads a valid (min, max) range down through the recursion.
// Time: O(n), Space: O(h).
function isValidBST(node, min = -Infinity, max = Infinity) {
  if (!node) return true;                     // empty tree/subtree is trivially valid
  if (node.value <= min || node.value >= max) return false;
  return (
    isValidBST(node.left, min, node.value) &&   // left subtree must stay below node.value
    isValidBST(node.right, node.value, max)     // right subtree must stay above node.value
  );
}

const good = new BSTNode(5);
good.left = new BSTNode(3);
good.right = new BSTNode(8);
console.log(isValidBST(good)); // true

// A tree that "looks" locally fine (each node > its parent's left, etc.) but is invalid:
const bad = new BSTNode(5);
bad.left = new BSTNode(3);
bad.right = new BSTNode(8);
bad.right.left = new BSTNode(4); // 4 < 5, but it's in the root's RIGHT subtree — invalid
console.log(isValidBST(bad));    // false
```

## Common Pitfalls / Gotchas

- Only comparing a node to its direct children when validating a BST, instead of threading a running `(min, max)` bound down the recursion — this misses violations from nodes further down that break the invariant relative to an ancestor rather than their immediate parent.
- In two-child deletion, forgetting to actually delete the successor node from its original position after copying its value up — this leaves a duplicate value in the tree.
- Using the inorder *predecessor* and *successor* inconsistently, or grabbing the wrong one (successor = leftmost of right subtree; predecessor = rightmost of left subtree) — mixing them up silently breaks the ordering invariant.
- Assuming BST operations are O(log n) unconditionally — that bound only holds when the tree is reasonably balanced. Inserting sorted or near-sorted data into a plain BST produces a degenerate, linked-list-shaped tree with O(n) operations.
- Allowing duplicate values without a defined policy — silently allowing them to go either left or right inconsistently breaks both the invariant and the correctness of search.

## Interview Questions & Answers

**Q: What is the time complexity of search, insert, and delete on a BST, and why does it vary?**
A: All three are O(h), where h is the tree's height. On a balanced tree, h is O(log n), giving fast logarithmic operations. But a plain (unbalanced) BST can degenerate — for example if values are inserted in already-sorted order, every node ends up with only one child, making the tree effectively a linked list with h = n. So the same operations become O(n) worst case. This is exactly the motivation for self-balancing trees like AVL and red-black trees, which guarantee O(log n) by keeping height bounded.

**Q: How do you delete a node with two children from a BST, and why not just remove it directly?**
A: You can't remove it directly because it's the connection point between two subtrees — deleting it would orphan one of them. Instead, find its inorder successor (leftmost node in its right subtree, i.e., the smallest value greater than the node), copy that value into the node being deleted, then recursively delete the successor from its original location. The successor is guaranteed to have at most one child (specifically no left child, since it was reached by going left as far as possible), so its own removal always falls into the simple leaf or one-child case.

**Q: How would you validate whether a given binary tree is a valid BST?**
A: Recursively track a valid `(min, max)` range for each node as you descend, rather than only comparing a node to its immediate children. The root can be anything; its left child must be less than the root (so the right bound tightens to the root's value), and its right child must be greater (left bound tightens). Each recursive call narrows the allowed range further, so a violation anywhere in the tree — not just at the immediate parent-child level — gets caught. This runs in O(n) time and O(h) space.

**Q: How would you find the k-th smallest element in a BST?**
A: Do an inorder traversal (left, node, right) — since that visits nodes in ascending sorted order — and stop as soon as you've visited k nodes, returning the k-th one. You don't need to build the entire sorted array; an iterative inorder traversal using an explicit stack can stop early after popping k nodes, giving O(h + k) time instead of a full O(n) traversal.

**Q: What's the difference between a BST and a self-balancing tree like an AVL tree?**
A: A plain BST only enforces the ordering invariant (left < node < right); nothing prevents it from becoming skewed and degrading to O(n) operations. An AVL tree enforces the same ordering invariant *plus* a balance invariant — the heights of any node's two subtrees may differ by at most 1 — and actively restores that balance via rotations after every insert/delete. That extra bookkeeping guarantees O(log n) height, and therefore O(log n) worst-case search/insert/delete, at the cost of doing more work per mutation.

## Related Topics

- [trees.md](./trees.md)
- [avl-trees.md](./avl-trees.md)
- [heaps.md](./heaps.md)
- [recursion.md](./recursion.md)
- [searching-algorithms.md](./searching-algorithms.md)
- [big-o-notation.md](./big-o-notation.md)
