# Data Structures & Algorithms Interview Prep

This folder is a personal knowledge base for studying and teaching core data structures and algorithms (DSA) for technical interviews. Each file covers one topic in depth — a real conceptual explanation of how the structure or algorithm actually works internally, runnable JavaScript implementations, common pitfalls, and interview-style Q&A — so you can both refresh your own understanding quickly and walk someone else through the same concept from first principles.

Unlike a syntax reference, this folder is organized around *mechanism*: for every structure, know what operations it supports, why each operation has the time/space complexity it has, and what breaks (or degrades) it. That's the level interviewers actually probe at — "why is this O(log n)?" and "what's the worst case?" matter far more than reciting a definition.

## Table of Contents

### Complexity Analysis
- [Big-O Notation](./big-o-notation.md)
- [Asymptotic Notations (Ω, Θ, O)](./asymptotic-notations.md)
- [Time Complexity](./time-complexity.md)
- [Space Complexity](./space-complexity.md)

### Linear Structures
- [Arrays](./arrays.md)
- [Linked Lists](./linked-lists.md)
- [Stacks](./stacks.md)
- [Queues](./queues.md)

### Hashing
- [Hash Tables](./hash-tables.md)

### Trees
- [Trees](./trees.md)
- [Binary Search Trees](./binary-search-trees.md)
- [AVL Trees](./avl-trees.md)
- [Heaps](./heaps.md)
- [Trie](./trie.md)

### Graphs
- [Graphs](./graphs.md)
- [Minimum Spanning Tree](./minimum-spanning-tree.md)

### Algorithmic Paradigms: Recursion, Divide & Conquer, DP, Greedy
- [Recursion](./recursion.md)
- [Divide and Conquer](./divide-and-conquer.md)
- [Dynamic Programming](./dynamic-programming.md)
- [Greedy Algorithms](./greedy-algorithms.md)

### Sorting & Searching
- [Sorting Algorithms](./sorting-algorithms.md)
- [Searching Algorithms](./searching-algorithms.md)

## Interview Questions & Answers — Curated

**Q (Beginner): What's the difference between time complexity and space complexity?**
A: Time complexity measures how the number of operations an algorithm performs grows as a function of input size `n`. Space complexity measures how much *extra* memory (beyond the input itself) it needs, also as a function of `n`. They're independent axes — an algorithm can trade one for the other, e.g. memoization spends O(n) extra space to cut time from exponential to linear.

**Q (Beginner): What does it mean for Big-O to describe the "worst case"?**
A: Big-O gives an asymptotic upper bound on growth rate — by convention, interview and textbook usage almost always applies it to the worst-case input, i.e. the input that makes the algorithm do the most work. This matters because average-case behavior can look very different (e.g. quicksort is O(n log n) on average but O(n²) worst case on already-sorted input with a naive pivot).

**Q (Beginner): Array vs linked list — when would you choose each?**
A: Arrays give O(1) random access by index and better cache locality (contiguous memory), but O(n) insert/delete in the middle because elements must shift. Linked lists give O(1) insert/delete once you have a reference to the node, but O(n) access/search because you must walk from the head, plus per-node pointer overhead. Choose arrays when you need indexed access or iterate sequentially often; choose linked lists when you insert/delete frequently at arbitrary positions and rarely need random access.

**Q (Intermediate): When would you choose a hash table over a BST?**
A: Choose a hash table when you need average O(1) insert/search/delete and don't care about ordering. Choose a (balanced) BST when you need operations a hash table can't give you efficiently: in-order traversal in sorted order, range queries, finding the min/max, or the predecessor/successor of a key — all O(log n) on a balanced BST, but O(n) (a full sort) on a hash table's contents.

**Q (Intermediate): Explain amortized time complexity for dynamic array resizing.**
A: A dynamic array (like JS arrays or `ArrayList`) doubles its backing capacity when full. A single doubling copies all `n` existing elements — O(n) for that one push. But doublings become exponentially rarer (after size 1, 2, 4, 8, 16...), so if you sum the total copy cost over `n` pushes and divide by `n`, you get O(1) *amortized* per push, even though individual pushes occasionally cost O(n). Amortized analysis looks at the total cost of a sequence of operations, not the worst single operation in isolation.

**Q (Intermediate): Compare DFS and BFS use cases.**
A: BFS explores level by level using a queue, and is the right choice when you need the *shortest path* in an unweighted graph or the shallowest solution (e.g. minimum moves, minimum connections). DFS explores as deep as possible before backtracking, using a stack (or recursion), and is preferred for exhaustive exploration — detecting cycles, topological sort, connected components, or when memory is a concern (DFS's stack depth is bounded by the longest path, while BFS's queue can hold an entire graph "frontier," which is much wider in a bushy graph).

**Q (Intermediate): What's the difference between a stack-based and queue-based traversal implemented explicitly (i.e., not using recursion for DFS)?**
A: Recursion implicitly uses the call stack, so an explicit-stack DFS just makes that mechanism visible: push a node, pop it, push its unvisited neighbors, repeat. A queue-based BFS pops from the front and pushes new neighbors to the back, so nodes are processed in the order they were *discovered*, guaranteeing shortest-hop-count order in an unweighted graph — a stack cannot guarantee that because LIFO order revisits the most recently discovered branch first, going deep instead of wide.

**Q (Intermediate): Why is a balanced BST's height O(log n), and why does that matter?**
A: A balanced BST (AVL, red-black) enforces that for every node, the heights of its left and right subtrees differ by a bounded amount (e.g. at most 1 for AVL). This forces the tree to stay "bushy" rather than degenerate into a linked list, which caps the height at O(log n) for n nodes. Since search/insert/delete all walk root-to-leaf paths, the height directly bounds those operations' worst-case time — without balancing, a BST can degrade to O(n) if data is inserted in sorted order.

**Q (Intermediate): What is the load factor of a hash table, and why does it matter?**
A: Load factor = (number of stored entries) / (number of buckets). As it climbs, more keys collide into the same bucket, degrading average lookup from O(1) toward O(n) (in a chained implementation) since each bucket must be scanned linearly. Hash tables resize (typically doubling capacity and rehashing all entries) once load factor crosses a threshold (commonly ~0.75) to keep operations close to O(1) amortized.

**Q (Advanced): When does greedy fail where DP succeeds?**
A: Greedy makes the locally optimal choice at each step and never reconsiders it — this only produces a globally optimal answer when the problem has both the *greedy-choice property* and *optimal substructure*. The classic counterexample is 0/1 knapsack: picking items by best value-to-weight ratio first (greedy) can leave you with wasted capacity and a suboptimal total value, because you can't take a fractional item to fill the remaining space (unlike the *fractional* knapsack, where greedy by ratio is provably optimal). DP instead explores the full decision space (take item i or don't) but avoids recomputation by caching subproblem results, guaranteeing the true optimum.

**Q (Advanced): What's the difference between divide-and-conquer and dynamic programming?**
A: Both break a problem into subproblems, but divide-and-conquer subproblems are *independent* (e.g. merge sort's two halves share no data), so there's nothing to cache — you just recurse and combine. DP subproblems *overlap* (e.g. `fib(5)` and `fib(4)` both need `fib(3)`), so naive recursion redoes the same work exponentially many times; DP explicitly caches (memoization) or builds up (tabulation) results to avoid that redundant recomputation, turning exponential time into polynomial time.

**Q (Advanced): Why is Dijkstra's algorithm O((V+E) log V) with a binary heap, and why doesn't it work with negative edge weights?**
A: Each vertex is extracted from the priority queue once (O(log V) per extraction, O(V log V) total) and each edge triggers at most one decrease-key/insert into the heap (O(log V) per edge, O(E log V) total) — summing gives O((V+E) log V). It fails with negative weights because Dijkstra's correctness relies on the invariant that once a vertex is popped with its shortest distance finalized, no future relaxation can improve it — a negative edge discovered later could still shorten a path to an already-finalized vertex, violating that assumption. (Bellman-Ford, O(V·E), handles negative weights correctly and detects negative cycles.)

**Q (Advanced): How would you find the kth largest element in an unsorted array, and what's the best complexity?**
A: Sorting gives O(n log n). A min-heap of size k gives O(n log k): push the first k elements, then for each remaining element, push it and pop the min if the heap exceeds size k — the heap's root ends up being the kth largest. The optimal average case is Quickselect (a partition-based selection algorithm related to quicksort), which achieves O(n) average time (O(n²) worst case, avoidable with median-of-medians pivot selection for guaranteed O(n)) by only recursing into the partition that contains the target index instead of both halves.

**Q (Advanced): Why does a trie beat a hash table for prefix-based lookups (e.g. autocomplete)?**
A: A hash table gives O(1) average lookup for an *exact* key but offers no way to find "all keys starting with prefix X" short of scanning every entry — hashing destroys locality between related keys. A trie stores keys character-by-character along shared root-to-node paths, so a lookup that walks to the end of a prefix takes O(m) (m = prefix length) and then a traversal of that subtree yields every matching key, without scanning unrelated entries.

**Q (Advanced): Reverse a singly linked list. Walk through the pointer manipulation.**
A: Iteratively, keep three pointers: `prev` (starts `null`), `curr` (starts at `head`), and `next`. In each iteration: save `next = curr.next` (so you don't lose the rest of the list), rewire `curr.next = prev` (reverse this node's pointer), then advance `prev = curr` and `curr = next`. Repeat until `curr` is `null`; `prev` is the new head. This is O(n) time and O(1) space. A recursive version is also O(n) time but O(n) space due to the call stack. See [linked-lists.md](./linked-lists.md) for the full implementation.

## How to Use This Folder

Work roughly in the order of the table of contents: complexity analysis first (you need Big-O vocabulary to talk about anything else), then linear structures, then hashing, then trees, then graphs, then the algorithmic paradigms (recursion underlies divide-and-conquer, DP, and backtracking, so it comes first), and finally sorting/searching, which ties most of the earlier concepts together in one place.

For each topic file, don't just read the code — trace it by hand on a small input (5-7 elements is usually enough) until you can predict its output and state its complexity without looking. Then close the file and try to re-derive the implementation from the conceptual explanation alone; the gap between "I understood it while reading" and "I can write it from scratch" is exactly what interviews test. Use the "Interview Questions & Answers" sections in each file as a rehearsal script — say the answer out loud, not just in your head.
