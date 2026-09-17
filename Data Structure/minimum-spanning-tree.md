# Minimum Spanning Tree

A minimum spanning tree (MST) of a connected, undirected, weighted graph is a subset of its edges that connects every vertex together (a "spanning" tree — every vertex is reachable), contains no cycles (it's a tree — exactly V−1 edges for V vertices), and has the minimum possible total edge weight among all such spanning trees. MSTs model problems like designing a road/cable/pipe network that connects every location at minimum total cost — you need every location reachable, you never want a redundant (cycle-forming) connection since that wastes cost, and among all cycle-free connected layouts, you want the cheapest one.

**Kruskal's algorithm** builds the MST by greedily considering edges in increasing order of weight, adding each edge unless it would create a cycle with edges already chosen. Detecting "would this edge create a cycle" efficiently requires a **union-find** (disjoint-set) structure: each vertex starts in its own set, and an edge is safe to add exactly when its two endpoints are currently in *different* sets (adding it then merges those sets); if they're already in the same set, they're already connected through previously chosen edges, and adding this edge would form a cycle. With **path compression** (flattening the tree during `find` so future lookups are faster) and **union by rank** (always attaching the smaller tree under the larger tree's root), union-find operations run in amortized O(α(n)) — the inverse Ackermann function, which grows so slowly it's effectively a small constant (≤ 5) for any realistic input size.

**Prim's algorithm** takes a different approach: starting from an arbitrary vertex, it grows a single connected tree one vertex at a time, always adding the cheapest edge that connects a vertex already in the tree to one that isn't. A simple array-based implementation (tracking, for each vertex outside the tree, the cheapest known edge connecting it to the tree so far) runs in O(V²), which is competitive for **dense** graphs; using a binary heap as a priority queue to always extract the next cheapest crossing edge improves this to O(E log V), better for **sparse** graphs. Both algorithms are greedy and both are provably correct via the **cut property** (for any partition of vertices into two groups, the minimum-weight edge crossing that partition is safe to include in *some* MST) — Kruskal exploits this globally by weight order, Prim exploits it locally by growing outward from a single tree.

## Examples

```js
// Union-Find (disjoint set) with path compression and union by rank —
// the enabling data structure for Kruskal's cycle detection.
class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i); // each vertex is its own set initially
    this.rank = new Array(n).fill(0);
  }

  find(x) {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // path compression: flatten as we go
    }
    return this.parent[x];
  }

  union(a, b) {
    const rootA = this.find(a), rootB = this.find(b);
    if (rootA === rootB) return false; // already connected — this edge would form a cycle

    // union by rank: attach the shorter tree under the taller one's root
    if (this.rank[rootA] < this.rank[rootB]) this.parent[rootA] = rootB;
    else if (this.rank[rootA] > this.rank[rootB]) this.parent[rootB] = rootA;
    else { this.parent[rootB] = rootA; this.rank[rootA]++; }
    return true; // union succeeded — no cycle
  }
}
```

```js
// Kruskal's algorithm: sort edges by weight, greedily add each edge that doesn't
// form a cycle (checked via union-find), stop once V-1 edges are chosen.
function kruskal(numVertices, edges) {
  // edges: [[u, v, weight], ...]
  const sorted = [...edges].sort((a, b) => a[2] - b[2]);
  const uf = new UnionFind(numVertices);
  const mst = [];
  let totalWeight = 0;

  for (const [u, v, weight] of sorted) {
    if (uf.union(u, v)) {        // returns true only if u and v were in different sets
      mst.push([u, v, weight]);
      totalWeight += weight;
      if (mst.length === numVertices - 1) break; // MST complete — V-1 edges for V vertices
    }
  }
  return { mst, totalWeight };
}

const edges = [
  [0, 1, 4], [0, 2, 1], [1, 2, 2], [1, 3, 5], [2, 3, 8],
];
kruskal(4, edges); // mst: [[0,2,1],[1,2,2],[1,3,5]], totalWeight: 8
```

```js
// Prim's algorithm, simple O(V^2) version — good for dense graphs (adjacency matrix).
// key[v] = cheapest edge weight connecting v to the growing tree; 0 = "unweighted" absent edge.
function primMST(numVertices, adjMatrix) {
  const inMST = new Array(numVertices).fill(false);
  const key = new Array(numVertices).fill(Infinity);
  const parent = new Array(numVertices).fill(-1);
  key[0] = 0; // start growing the tree from vertex 0
  let totalWeight = 0;

  for (let count = 0; count < numVertices; count++) {
    // pick the not-yet-included vertex with the smallest key (cheapest crossing edge)
    let u = -1;
    for (let v = 0; v < numVertices; v++) {
      if (!inMST[v] && (u === -1 || key[v] < key[u])) u = v;
    }
    inMST[u] = true;
    totalWeight += key[u];

    // relax: for every neighbor of u not yet in the tree, see if u offers a cheaper edge
    for (let v = 0; v < numVertices; v++) {
      if (adjMatrix[u][v] > 0 && !inMST[v] && adjMatrix[u][v] < key[v]) {
        key[v] = adjMatrix[u][v];
        parent[v] = u;
      }
    }
  }
  return { parent, totalWeight };
}
```

## Common Pitfalls / Gotchas

- Implementing union-find without path compression or union by rank — plain union-find degrades toward O(n) per operation on a skewed tree, which erases Kruskal's efficiency advantage from sorting; both optimizations together are what give the near-constant amortized O(α(n)).
- Forgetting that Kruskal's correctness *depends* on processing edges in strictly increasing weight order — sorting is not optional, it's the mechanism that makes the greedy cycle-avoidance choice provably optimal.
- Using Prim's O(V²) array-based version on a very sparse graph (E ≪ V²) — a binary-heap priority queue version (O(E log V)) is significantly faster there, since the O(V²) version does a full O(V) scan for the minimum key on every one of V iterations regardless of how few edges actually exist.
- Assuming an MST is unique — it's only guaranteed unique if all edge weights are distinct; with duplicate weights, multiple different edge sets can achieve the same (minimum) total weight, and Kruskal vs. Prim (or even the same algorithm with different tie-breaking) can legitimately return different valid MSTs.
- Running either algorithm on a disconnected graph and expecting a single spanning tree — neither can connect components that have no edge between them; Kruskal simply stops with fewer than V−1 edges (a minimum spanning *forest*), and Prim's simple version would leave unreachable vertices with `key = Infinity` forever.

## Interview Questions & Answers

**Q: What is a minimum spanning tree, and what three properties define it?**
A: Given a connected, weighted, undirected graph, an MST is a subset of edges that (1) connects all vertices (spanning), (2) contains no cycles and therefore has exactly V−1 edges for V vertices (a tree), and (3) has the minimum possible sum of edge weights among all spanning trees of that graph.

**Q: Walk through why Kruskal's algorithm needs union-find, and what path compression and union by rank each contribute.**
A: Kruskal must quickly answer "would adding this edge create a cycle?" for every candidate edge — that's exactly "are these two vertices already connected (in the same set)?", which union-find answers via `find`. Path compression flattens the tree structure during `find` calls so that repeated queries on the same vertices get progressively faster. Union by rank keeps the disjoint-set trees themselves shallow by always attaching the smaller tree under the larger tree's root instead of arbitrarily. Together, they bring union-find's amortized time per operation down to O(α(n)) — the inverse Ackermann function, effectively constant for any input size that could exist in practice.

**Q: Kruskal vs. Prim — when would you choose one over the other?**
A: Kruskal (O(E log E) from sorting edges, dominated by the sort) tends to be simpler and better suited to sparse graphs represented as an edge list, since its cost scales with the number of edges. Prim's simple array-based version is O(V²), which is actually preferable for dense graphs (E close to V²) since it doesn't pay a sorting cost and its per-iteration vertex scan is cheap relative to a huge edge count; a heap-based Prim's (O(E log V)) is competitive with Kruskal for sparse graphs too, making the choice often come down to whichever is more natural given how the graph is already represented (adjacency list favors Kruskal/heap-Prim, adjacency matrix favors simple Prim).

**Q: Both algorithms are greedy — why are they provably correct despite greedy often failing (e.g., on 0/1 knapsack)?**
A: Both rely on the **cut property**: for any way of partitioning the graph's vertices into two non-empty groups, the minimum-weight edge crossing between the two groups is guaranteed to be part of *some* MST. Kruskal exploits this globally — processing edges in increasing weight order and using union-find to avoid cycles effectively respects the cut property at every step. Prim exploits it locally — the "tree so far" vs. "everything else" is itself a cut at every iteration, and always adding the cheapest crossing edge is exactly the cut property applied directly. This proof is what distinguishes MST from problems like 0/1 knapsack, where no such property holds and greedy provably fails.

**Q: What happens if you run Kruskal's or Prim's algorithm on a disconnected graph?**
A: Neither produces a true MST, since no single tree can span disconnected components. Kruskal naturally produces a minimum spanning *forest* — it simply runs out of edges that can be safely added once each component is internally fully connected, ending with fewer than V−1 total edges. Prim's simple version, started from one component, would leave vertices in other components permanently at `key = Infinity`, since there's no edge from the growing tree that could ever reach them — this needs to be detected and handled explicitly (e.g., by running Prim's separately per connected component) if a spanning forest across a disconnected graph is the actual goal.

## Related Topics

- [graphs.md](./graphs.md)
- [greedy-algorithms.md](./greedy-algorithms.md)
- [heaps.md](./heaps.md)
- [big-o-notation.md](./big-o-notation.md)
</content>
</invoke>
