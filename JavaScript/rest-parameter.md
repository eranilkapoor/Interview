# Rest Parameter

The rest parameter (`...args`, ES2015) collects any number of remaining arguments passed to a function into a single, real `Array`. It must be the last parameter in a function's parameter list, and there can only be one per function. Rest parameters give variadic functions (functions that accept a variable number of arguments) a clean, array-native way to work with "everything else," replacing the older, clunkier `arguments` object.

Unlike `arguments`, which is an array-*like* object (has a `length` and indexed access, but lacks array methods like `.map`/`.filter`/`.reduce`) and is only available in regular functions (not arrow functions), the rest parameter is a genuine `Array` instance everywhere it's used, and works identically in arrow functions, which have no `arguments` object of their own. Rest parameters can also be used in destructuring patterns to capture "the remaining elements" of an array or "the remaining properties" of an object.

Modern style guides recommend rest parameters over `arguments` unconditionally: they're more explicit about intent (named, not implicit), fully array-capable, and consistently available regardless of function type (arrow vs regular), whereas `arguments` behavior with arrow functions is a frequent source of confusion for less experienced developers.

## Examples

```js
// Basic variadic function using rest parameters
function sum(...numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}
console.log(sum(1, 2, 3));     // 6
console.log(sum(1, 2, 3, 4, 5)); // 15
```

```js
// Rest parameters combined with named parameters (must come last)
function describeTeam(lead, ...members) {
  console.log(`Lead: ${lead}, Members: ${members.join(', ')}`);
}
describeTeam('Anil', 'Sunita', 'Lakshya'); // "Lead: Anil, Members: Sunita, Lakshya"
```

```js
// Rest works in arrow functions; `arguments` does not exist there
const sumArrow = (...numbers) => numbers.reduce((a, b) => a + b, 0);
console.log(sumArrow(10, 20, 30)); // 60

const broken = () => {
  console.log(arguments); // ReferenceError (or refers to an outer function's `arguments`)
};
```

## Common Pitfalls / Gotchas

- Trying to place a rest parameter anywhere but last in the parameter list — `function f(...rest, last) {}` is a `SyntaxError`; rest must be the final parameter.
- Confusing rest parameters with the `arguments` object — `arguments` is array-*like* (no `.map`/`.filter`) and doesn't exist in arrow functions; rest parameters are true arrays and work everywhere.
- Trying to use two rest parameters in one function signature — only one is allowed.
- Forgetting that a destructured rest element (`const [a, ...rest] = arr`) creates a *new* array — mutating `rest` doesn't affect the original array.

## Interview Questions & Answers

**Q: What's the difference between the rest parameter and the `arguments` object?**
A: `arguments` is an array-like object automatically available in regular (non-arrow) functions, containing all passed arguments regardless of the declared parameter list — but it lacks array methods and must be converted (e.g., `Array.from(arguments)`) to use them. The rest parameter is an explicitly declared, named, real `Array`, works in both regular and arrow functions, and only captures the arguments *not* matched by earlier named parameters.

**Q: Why doesn't `arguments` work inside arrow functions?**
A: Arrow functions don't have their own `this`, `arguments`, `super`, or `new.target` — they inherit these lexically from the enclosing (non-arrow) scope. So referencing `arguments` inside an arrow function either throws (if there's no enclosing function) or accidentally refers to an *outer* function's `arguments`, which is rarely what's intended. Rest parameters are the correct replacement.

**Q: Can you have a rest parameter alongside other named parameters?**
A: Yes, as long as the rest parameter is last: `function f(a, b, ...rest)` — `rest` captures every argument beyond the first two.

## Related Topics
- [spread-operator.md](./spread-operator.md)
- [default-parameters.md](./default-parameters.md)
- [destructuring-assignment.md](./destructuring-assignment.md)
- [arrow-function.md](./arrow-function.md)
