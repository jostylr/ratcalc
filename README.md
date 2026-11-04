# RatCalc (terminal)

A JavaScript REPL with exact rational arithmetic from
[RatMath Core](../../packages/core). Input is ordinary JavaScript; Core's
classes and parsers are in scope, and the `R` tag turns exact-number
expressions into Core values. Results that are Core values are shown exactly
(fraction, repeating decimal, interval). RiX is a separate language; this is
not it.

```text
$ bun apps/calc/index.js
> R`1:2 + 3`
4:5
> let x = R`1/3`
1/3 = 0.#3
> R`(${x} + 1) ^ 2`
16/9 = 1.#7
> [1, 2, 3, 4].map(n => R`1/${n}`).reduce((a, b) => a.add(b))
25/12 = 2.08#3
> 0.1 + 0.2
0.30000000000000004 (inexact JS number; R`…` keeps it exact)
> display("mixed"); R`25/12`
2..1/12
```

## Running

```bash
bun apps/calc/index.js                  # interactive
bun apps/calc/index.js -e 'R`1/3 + 1/6`' # one input
printf 'let a = R`2/3`\nR`${a}^3`\n' | bun apps/calc/index.js
bun run calc                            # from the repository root
```

Each line is one input; declarations (`let`, `const`, `var`, `function`,
`class`) persist between inputs and `ans` is the previous result.

## In scope

- `R` — exact expressions: literals such as `3`, `1/2`, `1..3/4`, `0.#3`,
  `1.23[56:67]`, `1_000`, `1.5?`; operators `+ - * / ^ ! :`; `${…}` values stay
  exact (Core values, bigints, safe integers or literal strings).
- Every `@ratmath/core` export: `Integer`, `Rational`, `RationalInterval`,
  `Fraction`, `parseNumber`, `parseInterval`, `BaseSystem`, ...
- `display("both" | "exact" | "decimal" | "mixed" | "cf")`, `digits(n)`,
  `vars()`, `clear()`, `help()`, `show(value)`, `ans`.
- Terminal commands: `.help`, `.vars`, `.clear`, `.exit`.

Network access, `import`/`export`, `process`, `require` and other host
escapes are not available in calculator input. This is a convenience guard, not
a security boundary; the web calculator also sets a Content-Security-Policy.

The session engine (`src/session.js`, exported as `ratcalc/session`) is shared
with the web calculator in `apps/webcalc`.

## Tests

```bash
bun test apps/calc/tests
```

## What changed from the legacy calculator

Version 2 replaces the legacy expression language (the `VariableManager` from
`@ratmath/algebra` and the grammar in `@ratmath/parser`) with JavaScript plus
`R`. Dropped with it: the calculator-specific syntax (uppercase functions,
`IF`/`MULTI`, `x = ...` without JavaScript semantics, `#` comments), the
`DECI`/`RAT`/`BOTH`/`SCI`/`CF`/`MIX`/`LIMIT` commands (now `display()` and
`digits()`), input/output base commands, optional package loading
(`reals`, `oracles`, `arith-funs`), and the strictness/oracle tests that
covered that language. Use JavaScript and Core methods instead (for example
``R`7/3`.toBase(BaseSystem.fromBase(2))`` gives `111/11`, and
``R`1/7`.toContinuedFractionString()`` gives `0.~7`),
or RiX for a full exact-math language.
