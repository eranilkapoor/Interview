# History of JavaScript

JavaScript was created in 1995 by Brendan Eich at Netscape in just about 10 days. It was originally named Mocha, then LiveScript, and was finally renamed JavaScript as a marketing move to ride on the popularity of Java at the time — despite the two languages having almost nothing in common syntactically or semantically beyond curly braces. The first engine, SpiderMonkey, was written by Eich himself and still powers Firefox today.

In 1996, Netscape submitted JavaScript to ECMA International for standardization, which produced the ECMAScript (ES) specification. This is why "JavaScript" and "ECMAScript" are often used interchangeably: JavaScript is the most well-known implementation of the ECMAScript standard. Early years were marked by the "browser wars," where Microsoft shipped JScript in Internet Explorer with subtle incompatibilities, leading to years of cross-browser pain for developers.

The language stagnated somewhat after ES3 (1999) — ES4 was abandoned due to disagreements about its scope — until ES5 (2009) brought strict mode, JSON support, and array iteration methods. The real turning point was ES2015 (ES6), a massive release that added classes, modules, `let`/`const`, arrow functions, promises, template literals, and destructuring, modernizing the language substantially. Since then, TC39 (the committee that manages the spec) has shipped a new yearly ECMAScript edition (ES2016, ES2017, ... ES2023+), each adding smaller, incremental features rather than one giant release.

Outside the browser, Ryan Dahl created Node.js in 2009 by pairing Google's V8 engine with an event-driven, non-blocking I/O model, turning JavaScript into a genuine general-purpose, server-side language. That single decision is arguably as responsible for JavaScript's modern dominance as any single language feature — it enabled full-stack JavaScript development and the npm ecosystem, the largest package registry in the world.

## Examples

```js
// ES3-era code (still valid today) — function-based, no block scoping
var i;
for (i = 0; i < 3; i++) {
  console.log(i);
}
```
This demonstrates the "old" way of writing loops using `var`, which is function-scoped, not block-scoped — a limitation later addressed by `let` in ES2015.

```js
// ES2015+ modernized version
for (let i = 0; i < 3; i++) {
  console.log(i);
}
// Each iteration gets its own binding of `i`, fixing closures-in-loops bugs
```

```js
// Checking which ECMAScript features are available at runtime
console.log(typeof Promise !== 'undefined'); // true in any ES2015+ environment
console.log(typeof globalThis !== 'undefined'); // true in any ES2020+ environment
```
Feature detection like this is how libraries historically decided whether to load polyfills.

## Common Pitfalls / Gotchas

- Confusing "JavaScript" with "Java" — they are unrelated languages; the name was purely a marketing decision.
- Assuming ECMAScript version numbers map cleanly to browser support — actual support depends on each engine's implementation timeline, not the spec's publish date.
- Forgetting that many "modern" features (arrow functions, `let`, template literals) are only about a decade old; code targeting older environments (some enterprise/embedded contexts) may still need transpilation via Babel.
- Believing JavaScript was designed as a rigorous, carefully planned language — many quirks (`typeof null === 'object'`, type coercion rules) exist because of the 10-day original design sprint and a need for backward compatibility ever since.

## Interview Questions & Answers

**Q: Why is JavaScript called JavaScript if it's unrelated to Java?**
A: It was a marketing decision by Netscape in 1995 to capitalize on Java's popularity. The language was originally called Mocha, then LiveScript, before being renamed JavaScript. Technically, it's an implementation of the ECMAScript standard.

**Q: What was the significance of ES2015 (ES6)?**
A: It was the largest single update to the language, introducing `let`/`const`, classes, arrow functions, template literals, destructuring, default/rest parameters, modules, promises, and generators — effectively modernizing JavaScript and enabling patterns that previously required libraries or workarounds.

**Q: How did Node.js change JavaScript's trajectory?**
A: Node.js (2009) took the V8 engine out of the browser and combined it with an event-driven, non-blocking I/O runtime, letting JavaScript run as a server-side language. This enabled full-stack JavaScript, npm's massive package ecosystem, and tooling (build systems, CLIs) written in JS.

**Q: What is the relationship between JavaScript and ECMAScript?**
A: ECMAScript is the standard/specification (maintained by TC39 under ECMA International); JavaScript is the most popular language that implements that standard. Other implementations include JScript (old IE) and ActionScript.

## Related Topics
- [introduction-to-javascript.md](./introduction-to-javascript.md)
- [javascript-engine.md](./javascript-engine.md)
- [es2015.md](./es2015.md)
- [nodejs-runtime.md](./nodejs-runtime.md)
