# Graphs

A graph is a set of **vertices** (nodes) connected by **edges**, used to model relationships that aren't strictly hierarchical the way a tree is — social networks, road maps, dependency chains, web links. Edges can be **directed** (a one-way relationship, like "A follows B") or **undirected** (a symmetric relationship, like "A is friends with B"), and **weighted** (each edge carries a cost, like distance or time) or **unweighted**. Unlike trees, graphs can contain cycles and don't have a single root, so traversal algorithms need to explicitly track which vertices have already been visited to avoid looping forever.

The two dominant ways to represent a graph in code are the **adjacency matrix** (a V×V grid where `matrix[i][j]` indicates an edge between vertex i and j — O(1) edge lookup, but O(V²) space regardless of how sparse the graph is) and the **adjacency list** (each vertex maps to a list of its neighbors — O(V + E) space, which is far more efficient for sparse graphs where E is much smaller than V², at the cost of O(degree) edge lookup instead of O(1)). Adjacency lists are the more common real-world choice because most practical graphs (social networks, road networks) are sparse.

The two fundamental traversal algorithms are **BFS** (breadth-first search, exploring level by level using a queue) and **DFS** (depth-first search, exploring as deep as possible before backtracking, using a stack or recursion). Both visit every reachable vertex and edge exactly once, giving O(V + E) time, but they explore in fundamentally different orders: BFS guarantees finding the shortest path (fewest edges) in an unweighted graph because it exhausts every vertex at distance *k* before moving to distance *k+1*; DFS has no such guarantee but is naturally suited to problems like cycle detection, topological sorting, and connected-component discovery, and uses less memory on "bushy" graphs since its stack depth is bounded by the longest path rather than the widest frontier.

## Examples

```js
// Graph represented as an adjacency list using a Map — O(V + E) space.
class Graph {
  constructor() {
    this.adjList = new Map();
  }

  addVertex(vertex) {
    if (!this.adjList.has(vertex)) this.adjList.set(vertex, []);
  }

  // Undirected: an edge is added to BOTH vertices' neighbor lists.
  // (For a directed graph, only push v2 onto v1's list.)
  addEdge(v1, v2) {
    this.addVertex(v1);
    this.addVertex(v2);
    this.adjList.get(v1).push(v2);
    this.adjList.get(v2).push(v1);
  }
}

const graph = new Graph();
graph.addEdge('A', 'B');
graph.addEdge('A', 'C');
graph.addEdge('B', 'D');
graph.addEdge('C', 'D');
```

```js
// BFS: explore level by level with a queue. Guarantees shortest path (fewest
// edges) from `start` to any reachable vertex in an UNWEIGHTED graph.
function bfs(graph, start) {
  const visited = new Set([start]); // mark visited when ENQUEUED, not when dequeued,
  const queue = [start];            // to avoid enqueuing the same vertex multiple times
  const order = [];

  while (queue.length > 0) {
    const vertex = queue.shift(); // O(n) in a plain array; a real deque would be O(1)
    order.push(vertex);

    for (const neighbor of graph.adjList.get(vertex)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return order;
}

bfs(graph, 'A'); // ['A', 'B', 'C', 'D']
```

```js
// DFS: explore as deep as possible before backtracking. Recursive version uses
// the call stack implicitly; here shown both ways.
function dfsRecursive(graph, start) {
  const visited = new Set();
  const order = [];

  function visit(vertex) {
    if (visited.has(vertex)) return;
    visited.add(vertex);
    order.push(vertex);
    for (const neighbor of graph.adjList.get(vertex)) visit(neighbor);
  }

  visit(start);
  return order;
}

function dfsIterative(graph, start) {
  const visited = new Set();
  const stack = [start];
  const order = [];

  while (stack.length > 0) {
    const vertex = stack.pop();
    if (visited.has(vertex)) continue; // check on POP here, since duplicates can be pushed
    visited.add(vertex);
    order.push(vertex);
    for (const neighbor of graph.adjList.get(vertex)) {
      if (!visited.has(neighbor)) stack.push(neighbor);
    }
  }
  return order;
}

dfsRecursive(graph, 'A'); // ['A', 'B', 'D', 'C']
```

## Common Pitfalls / Gotchas

- Forgetting to track visited vertices — on a graph with cycles, this causes infinite loops (unlike trees, which are acyclic by definition and don't strictly need a visited set for traversal).
- Marking a vertex visited when it's *dequeued* in BFS instead of when it's *enqueued* — this can let the same vertex be added to the queue multiple times before it's ever processed, wasting work and, in some formulations, breaking the shortest-path guarantee.
- Using `Array.shift()` for the BFS queue — it's O(n) per call because it re-indexes the whole array, making a naive BFS O(V²) instead of O(V + E) on a large graph; a proper deque or index pointer avoids this in production code.
- Only pushing an edge onto one vertex's adjacency list for what should be an undirected graph (or the reverse: treating a directed graph's edges as bidirectional by accident).
- Assuming BFS or DFS alone finds the shortest path in a *weighted* graph — neither does; BFS's shortest-path guarantee only holds when all edges have equal (or no) weight. Weighted shortest paths need Dijkstra's algorithm (or Bellman-Ford for negative weights).

## Interview Questions & Answers

**Q: Adjacency list vs adjacency matrix — when would you choose each?**
A: Adjacency list (O(V + E) space) is the better default for sparse graphs, which most real-world graphs are — social networks, road networks, dependency graphs rarely have anywhere near V² edges. Adjacency matrix (O(V²) space) is worth it for dense graphs or when you need O(1) "is there an edge between u and v" lookups frequently, since a list requires scanning a vertex's neighbor list (O(degree)) to answer that.

**Q: Compare BFS and DFS — when is each the right choice?**
A: BFS explores level by level via a queue and is the right choice whenever you need the shortest path (fewest edges) in an unweighted graph, or the "closest" solution in general (minimum moves, degrees of separation). DFS explores as deep as possible before backtracking via a stack or recursion, and is preferred for exhaustive exploration tasks — detecting cycles, topological sorting, finding connected components — or when memory matters, since DFS's stack depth is bounded by the longest path while BFS's queue can hold an entire "frontier" that's much wider in a bushy graph.

**Q: What's the time and space complexity of BFS/DFS, and why?**
A: Both are O(V + E) time: every vertex is visited once (O(V)) and every edge is examined once from each endpoint that processes it (O(E)). Space is O(V) for the visited set plus the queue/stack/recursion depth, which in the worst case (a very wide or very deep graph) can also approach O(V).

**Q: How would you detect a cycle in a directed graph using DFS?**
A: Track three states per vertex instead of a plain visited/unvisited boolean: unvisited, "in progress" (currently on the current DFS path, i.e. an ancestor in the recursion), and "fully processed" (done, and popped off the path). If DFS encounters a neighbor that's "in progress," that's a back edge to an ancestor — a cycle. (For undirected graphs, a simpler check suffices: encountering a visited neighbor that isn't the immediate parent indicates a cycle.)

**Q: Why doesn't plain BFS work for shortest paths in a weighted graph?**
A: BFS's correctness relies on processing vertices in strictly increasing order of edge-count from the source, which only corresponds to "shortest distance" when every edge costs the same (1 hop = 1 unit of distance). With varying weights, a vertex reached via fewer hops isn't necessarily reached via less total weight — a path with more hops but smaller weights could be shorter overall. Dijkstra's algorithm generalizes this correctly by always expanding the vertex with the smallest known total distance next (using a priority queue), not simply the next one in hop order.

## Related Topics

- [minimum-spanning-tree.md](./minimum-spanning-tree.md)
- [trees.md](./trees.md)
- [big-o-notation.md](./big-o-notation.md)
- [space-complexity.md](./space-complexity.md)
- [recursion.md](./recursion.md)
</content>
</invoke>
<parameter name="file_path">D:\Learning-Projects\Interview\Data Structure\hash-tables.md