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

- `R` — exact expressions with RiX's literal spelling:
  `3`, `1/2`, `1..3/4` (mixed), `0.#3` (repeating), `1.2[3:6]` and
  `1.5[+-0.01]` (uncertainty), `2:5` (interval), `3.~7~15~1` (continued
  fraction), `2.5_^-2` (radix shift; there is no `E` notation), `0xff.8`,
  `0b0.#01`, `0z[7]66` (base prefixes), `1_000`, `1.5?`; operators
  `+ - * / ^ ** ! !! :` and parentheses. `${…}` values stay exact (Core
  values, bigints, safe integers or literal strings). ``R.base(16)`ff.8` ``
  reads unprefixed literals in another base.
- Every `@ratmath/core` export: `Integer`, `Rational`, `RationalInterval`,
  `Fraction`, `parseNumber`, `parseInterval`, `BaseSystem`, and the list
  helpers `sum`, `product`, `seq`, `range`.
- Display of every result: `display("both" | "exact" | "decimal" | "mixed" |
  "cf" | "sci")`, `digits(n)`, `sciDigits(n)`, and an output base with
  `base(16)`, `hex()`, `bin()`, `oct()` (`dec()` or `base(10)` to stop).
- One value at a time: `hex(x)`, `bin(x)`, `oct(x)`, `inBase(x, 7)`, `cf(x)`,
  `mix(x)`, `deci(x, 40)`, `sci(x, 6)`. Base text uses RiX prefixes, so
  ``R`0x1.#5` `` reads it back.
- `help()`, `help(x)` (the methods a value has, with examples), `vars()`,
  `clear()`, `show(value)`, `ans`.
- Terminal commands: `.help`, `.vars`, `.clear`, `.exit`.

### From the old calculator

| Old | Now |
|---|---|
| `1/2 + 3/4`, `5!`, `5!!`, `2^3`, `0.#3`, `1..2/3`, `2:5` | the same inside ``R`…` `` |
| `3.~7~15~1` | ``R`3.~7~15~1` `` |
| `1E3`, `2.5E-2` | ``R`1_^3` ``, ``R`2.5_^-2` `` (RiX spelling) |
| `1.2[3,6]`, `12[34,42]` | ``R`1.2[3:6]` ``, ``R`12[34:42]` `` (RiX needs `:`) |
| `**` multiplicative interval power | `x.mpow(n)` (`**` is the same as `^`, as in RiX) |
| `x = 5`, `P[x,y] = x^2 - y` | ``x = R`5` ``, ``P = (x, y) => R`${x}^2 - ${y}` `` |
| `SUM[i](i^2,1,10)`, `PROD[j](j,1,5)`, `SEQ[k](k^3,0,5,2)` | ``sum(1, 10, i => R`${i}^2`)``, `product(1, 5, j => j)`, ``seq(0, 5, 2, k => R`${k}^3`)`` |
| `DECI`, `RAT`, `BOTH`, `MIX`, `CF`, `SCI` | `display("decimal" / "exact" / "both" / "mixed" / "cf" / "sci")` |
| `LIMIT n`, `SCIPREC n` | `digits(n)`, `sciDigits(n)` |
| `BASE 16`, `HEX`, `BIN`, `OCT`, `DEC`, `BASE 0123456789ab` | `base(16)`, `hex()`, `bin()`, `oct()`, `dec()`, `base("0123456789ab")` |
| input in another base | ``R`0xff` `` or ``R.base(16)`ff.8` `` |
| `expr HEX`, `expr CF`, `expr MIX` | `hex(x)`, `cf(x)`, `mix(x)` |
| `VARS`, `CLEAR`, `HELP` | `vars()`, `clear()`, `help()` |

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
`R`; the table above maps the old features. Not carried over: the comma
interval form and `E` notation (RiX spells them `[a:b]` and `_^`), the
multiplicative meaning of `**` (use `.mpow(n)`), `SCIPERIOD`, optional package
loading (`reals`, `oracles`, `arith-funs`), and the strictness/oracle tests of
the old language. RiX remains the full exact-math language.
