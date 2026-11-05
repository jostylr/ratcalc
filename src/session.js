/**
 * RatCalc session: a JavaScript REPL with RatMath Core in scope.
 *
 * Input is JavaScript. Top-level `let`/`const`/`var`/`function`/`class`
 * declarations persist between inputs, the value of the last expression is
 * the result, and Core values display exactly (fractions, repeating decimals,
 * intervals). The `R` tag gives exact arithmetic on Core literals:
 *
 *   > x = R`1/3`
 *   1/3 = 0.#3
 *   > R`${x} + 1:2`
 *   4/3:7/3
 *
 * Shared by the terminal calculator (apps/calc) and the web calculator
 * (apps/webcalc). It is a convenience, not a security boundary: the web page
 * adds a Content-Security-Policy that blocks network access and imports.
 */
import * as Core from "@ratmath/core";

const { Integer, Rational, RationalInterval } = Core;

// Names hidden from calculator input: network, imports, and escapes to the
// host page. Reading one throws a short explanation.
const BLOCKED = new Set([
  "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker",
  "importScripts", "require", "process", "Bun", "Deno", "navigator", "localStorage",
  "sessionStorage", "indexedDB", "document", "window", "self", "top", "parent",
  "globalThis", "global", "opener", "frames",
]);

const DISPLAY_MODES = ["both", "exact", "decimal", "mixed", "cf", "sci"];

// --- input rewriting -------------------------------------------------------

/**
 * Turn top-level declarations into assignments on the session scope, so
 * `let x = 1` in one input is visible in the next. Strings, template literals,
 * comments and nested braces are skipped.
 */
export function rewriteDeclarations(source) {
  let out = "";
  let depth = 0;
  let statementStart = true;
  for (let i = 0; i < source.length;) {
    const ch = source[i];
    const two = source.slice(i, i + 2);
    if (two === "//") { const end = source.indexOf("\n", i); const stop = end === -1 ? source.length : end; out += source.slice(i, stop); i = stop; continue; }
    if (two === "/*") { const end = source.indexOf("*/", i + 2); const stop = end === -1 ? source.length : end + 2; out += source.slice(i, stop); i = stop; continue; }
    if (ch === '"' || ch === "'" || ch === "`") {
      const stop = skipString(source, i);
      out += source.slice(i, stop); i = stop; statementStart = false; continue;
    }
    if (depth === 0 && statementStart) {
      const rest = source.slice(i);
      const declaration = rest.match(/^(let|const|var)\s+(?=[[{A-Za-z_$])/);
      if (declaration) {
        const after = rest.slice(declaration[0].length);
        // Object destructuring needs parentheses to be an assignment expression.
        if (after.startsWith("{")) {
          const end = findStatementEnd(source, i + declaration[0].length);
          out += `(${source.slice(i + declaration[0].length, end)})`;
          i = end; statementStart = false; continue;
        }
        i += declaration[0].length; statementStart = false; continue;
      }
      const named = rest.match(/^(async\s+function\*?|function\*?|class)\s+([A-Za-z_$][\w$]*)/);
      if (named) {
        const end = findBlockEnd(source, i);
        out += `${named[2]} = ${source.slice(i, end)};`;
        i = end; statementStart = true; continue;
      }
    }
    if (ch === "{" || ch === "(" || ch === "[") depth += 1;
    if (ch === "}" || ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if (!/\s/.test(ch)) statementStart = depth === 0 && (ch === ";" || ch === "}") ? true : false;
    if (ch === "\n" && depth === 0) statementStart = true;
    out += ch; i += 1;
  }
  return out;
}

function skipString(source, start) {
  const quote = source[start];
  let i = start + 1;
  let depth = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") { i += 2; continue; }
    if (quote === "`" && ch === "$" && source[i + 1] === "{") { depth += 1; i += 2; continue; }
    if (quote === "`" && depth > 0) {
      if (ch === "}") depth -= 1;
      else if (ch === "`" || ch === '"' || ch === "'") { i = skipString(source, i); continue; }
      i += 1; continue;
    }
    if (ch === quote) return i + 1;
    i += 1;
  }
  return i;
}

function findStatementEnd(source, start) {
  let depth = 0;
  for (let i = start; i < source.length;) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") { i = skipString(source, i); continue; }
    if (ch === "{" || ch === "(" || ch === "[") depth += 1;
    if (ch === "}" || ch === ")" || ch === "]") depth -= 1;
    if (depth === 0 && (ch === ";" || ch === "\n")) return i;
    i += 1;
  }
  return source.length;
}

function findBlockEnd(source, start) {
  let depth = 0;
  let opened = false;
  for (let i = start; i < source.length;) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") { i = skipString(source, i); continue; }
    if (ch === "{") { depth += 1; opened = true; }
    if (ch === "}") { depth -= 1; if (opened && depth === 0) return i + 1; }
    i += 1;
  }
  return source.length;
}

// --- display ---------------------------------------------------------------

function isCore(value) {
  return value instanceof Integer || value instanceof Rational || value instanceof RationalInterval ||
    value?.isCertifiedApproximation === true || value instanceof Core.Fraction ||
    value instanceof Core.FractionInterval || value instanceof Core.RationalIntervalSet;
}

// A terminating decimal prints without Core's explicit "#0" period.
const plainDecimal = (text) => text?.replace(/#0(?=$|:)/g, "") ?? null;

function repeating(rational, digits) {
  try {
    return plainDecimal(rational.toRepeatingDecimal(digits, "trunc"));
  } catch {
    return null;
  }
}

/** A base system from a radix, a BaseSystem or a string listing the digits. */
export function baseSystemOf(base) {
  const { BaseSystem } = Core;
  if (base instanceof BaseSystem) return base;
  if (typeof base === "string") return new BaseSystem(base);
  const radix = Number(base instanceof Integer ? base.value : base);
  if (!Number.isSafeInteger(radix)) throw new TypeError("a base is a radix (2–62), a BaseSystem or a string of digits");
  return BaseSystem.fromBase(radix);
}

/**
 * RiX-style base text that R reads back: 0xff, -0x1.#5, 0b0.#01, and
 * 0z[n]... for bases without a registered prefix.
 */
export function formatInBase(value, base) {
  const system = baseSystemOf(base);
  if (value instanceof RationalInterval) return `${formatInBase(value.low, system)}:${formatInBase(value.high, system)}`;
  const exact = value instanceof Integer ? value.toRational() : value;
  if (!(exact instanceof Rational)) throw new TypeError("base formatting needs an Integer, Rational or RationalInterval");
  const prefix = Core.BaseSystem.getPrefixForSystem(system);
  const lead = prefix ? `0${prefix}` : `0z[${system.base}]`;
  const negative = exact.numerator < 0n;
  const digits = plainDecimal(exact.abs().toRepeatingBase(system));
  return `${negative ? "-" : ""}${lead}${digits}`;
}

/** Scientific text in RiX's radix-shift spelling, e.g. 1.6667_^-1 (… marks rounding). */
export function formatScientific(value, significant = 10) {
  const exact = value instanceof Integer ? value.toRational() : value;
  if (exact instanceof RationalInterval) return `${formatScientific(exact.low, significant)}:${formatScientific(exact.high, significant)}`;
  if (!(exact instanceof Rational)) throw new TypeError("scientific formatting needs an Integer, Rational or RationalInterval");
  if (exact.numerator === 0n) return "0";
  const negative = exact.numerator < 0n;
  const magnitude = exact.abs();
  const ten = new Rational(10);
  let exponent = magnitude.numerator.toString().length - magnitude.denominator.toString().length;
  while (magnitude.lessThan(ten.pow(exponent))) exponent -= 1;
  while (!magnitude.lessThan(ten.pow(exponent + 1))) exponent += 1;
  const scaled = magnitude.divide(ten.pow(exponent - significant + 1));
  let units = scaled.round("half-even");
  if (units === 10n ** BigInt(significant)) { units /= 10n; exponent += 1; }
  const text = units.toString();
  const mantissa = `${text[0]}${text.length > 1 ? `.${text.slice(1).replace(/0+$/, "")}` : ""}`.replace(/\.$/, "");
  const rounded = !scaled.equals(new Rational(units)) ? "…" : "";
  return `${negative ? "-" : ""}${mantissa}${exponent === 0 ? "" : `_^${exponent}`}${rounded}`;
}

function formatRational(value, mode, digits, settings = {}) {
  const exact = value.toString();
  if (mode === "sci") return formatScientific(value, settings.sciDigits ?? 10);
  if (value.denominator === 1n) return exact;
  if (mode === "exact") return exact;
  const decimal = repeating(value, digits) ?? value.toDecimal(digits);
  if (mode === "decimal") return decimal;
  if (mode === "mixed") return value.toMixedString();
  if (mode === "cf") return value.toContinuedFractionString();
  return decimal === exact ? exact : `${exact} = ${decimal}`;
}

/** Display text for any session value; Core values are shown exactly. */
export function formatValue(value, options = {}) {
  const { mode = "both", digits = 30, depth = 0, base = null } = options;
  const numeric = value instanceof Rational || value instanceof Integer || value instanceof RationalInterval;
  if (numeric && base && depth === 0) {
    const inner = formatValue(value, { ...options, base: null });
    return `${formatInBase(value, base)} = ${inner}`;
  }
  if (numeric && base) return formatInBase(value, base);
  if (value instanceof Rational) return formatRational(value, mode, digits, options);
  if (value instanceof Integer) return mode === "sci" ? formatScientific(value, options.sciDigits ?? 10) : value.toString();
  if (value instanceof RationalInterval && mode === "sci") return formatScientific(value, options.sciDigits ?? 10);
  if (value instanceof RationalInterval) {
    const exact = `${value.low.toString()}:${value.high.toString()}`;
    if (mode === "exact" || (value.low.denominator === 1n && value.high.denominator === 1n)) return exact;
    const decimal = plainDecimal(value.toRepeatingDecimal({ limit: digits })) ?? `${value.low.toDecimal(digits)}:${value.high.toDecimal(digits)}`;
    if (mode === "decimal") return decimal;
    return decimal === exact ? exact : `${exact} = ${decimal}`;
  }
  if (isCore(value)) return value.toString();
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return depth === 0 ? value : JSON.stringify(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "number") return Number.isInteger(value) || !Number.isFinite(value) ? String(value) : `${value} (inexact JS number; R\`…\` keeps it exact)`;
  if (typeof value === "function") return `[function ${value.name || "anonymous"}]`;
  if (typeof value === "symbol" || typeof value === "boolean") return String(value);
  if (depth > 3) return Array.isArray(value) ? "[…]" : "{…}";
  const inner = { ...options, mode: mode === "both" ? "exact" : mode, digits, depth: depth + 1 };
  if (Array.isArray(value)) return `[${value.map((item) => formatValue(item, inner)).join(", ")}]`;
  if (value instanceof Map) return `Map {${[...value].map(([k, v]) => `${formatValue(k, inner)} => ${formatValue(v, inner)}`).join(", ")}}`;
  if (value instanceof Set) return `Set {${[...value].map((item) => formatValue(item, inner)).join(", ")}}`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  const entries = Object.entries(value);
  return `{${entries.map(([k, v]) => `${k}: ${formatValue(v, inner)}`).join(", ")}}`;
}

// --- help ---------------------------------------------------------------

export const HELP_TEXT = `RatCalc is JavaScript with exact rational arithmetic.
Type any JavaScript; the last expression's value is shown.

Exact values with R (literals are spelled as in RiX):
  R\`1/3 + 1/6\`          -> 1/2          R\`1:2 + 3\`        -> 4:5 (interval)
  R\`1..2/3\`  mixed       R\`0.#3\` repeating   R\`1.2[3:6]\`  R\`1.5[+-0.01]\`
  R\`3.~7~15~1\` continued fraction -> 355/113    R\`2.5_^-2\` -> 1/40 (no E)
  R\`0xff.8\`  R\`0b0.#01\`  R\`0z[7]66\`  base prefixes; R.base(16)\`ff.8\`
  operators + - * / ^ ** ! !! :  and ( );  \${x} inserts a value exactly

JavaScript around R:
  let x = R\`2/3\`; R\`\${x}^2\`        declarations persist; ans = last result
  F = (n) => R\`1/\${n}\`; F(7)       functions are JavaScript functions
  sum(1, 10, i => R\`\${i}^2\`)  -> 385   product(1, 5, j => j) -> 120
  seq(0, 6, 2, k => R\`\${k}^3\`)  range(0, 1, R\`1/4\`)  sum([R\`1/2\`, R\`1/3\`])

Display (all results):  display("both" | "exact" | "decimal" | "mixed" | "cf" | "sci")
  digits(n) decimal digits   sciDigits(n) significant digits
  base(16) / hex() / bin() / oct() show results in a base too; dec() or base(10) to stop
One value:  hex(x) bin(x) oct(x) inBase(x, 7) cf(x) mix(x) deci(x, 40) sci(x, 6)
Methods:    help(x) lists what a value can do, e.g. help(R\`355/113\`)
            x.convergents()  x.bestApproximation(100)  x.toContinuedFraction()
Commands:   help() vars() clear()   (terminal: .help .vars .clear .exit)
JavaScript numbers like 0.1 are inexact; results that are plain numbers say so.`;

// One-line notes for the methods people reach for, by Core type.
const METHOD_NOTES = {
  Integer: [
    ["add/subtract/multiply/divide(y)", "exact arithmetic (divide gives a Rational)"],
    ["pow(n)", "R`2`.pow(10) -> 1024"],
    ["factorial() / doubleFactorial()", "R`5`.factorial() -> 120"],
    ["gcd(y) / lcm(y)", "R`12`.gcd(R`18`) -> 6"],
    ["floorDivide(y) / floorModulo(y) / divmod(y)", "floor quotient and remainder"],
    ["modulo(y)", "truncated remainder (sign of the dividend)"],
    ["isEven() / isOdd() / sign() / abs()", ""],
    ["toBase(BaseSystem.fromBase(2))", "digits in another base; or bin(x), hex(x)"],
    ["toRational() / toNumber()", "conversions (toNumber is inexact)"],
  ],
  Rational: [
    ["numerator / denominator", "bigint parts"],
    ["add/subtract/multiply/divide(y), pow(n)", "exact arithmetic"],
    ["toContinuedFraction() / toContinuedFractionString()", "R`355/113` -> [3, 7, 16] / 3.~7~16"],
    ["convergents() / getConvergent(n)", "R`355/113`.convergents() -> [3, 22/7, 355/113]"],
    ["bestApproximation(maxDen) / bestConvergent(maxDen)", "R`314159/100000`.bestApproximation(100) -> 311/99"],
    ["approximationError(target)", "distance to another value"],
    ["toRepeatingDecimal() / toDecimal(n)", "0.#142857 / truncated digits"],
    ["toRepeatingBase(system) / toBase(system)", "other bases; or hex(x), inBase(x, 7)"],
    ["toMixedString()", "R`22/7` -> 3..1/7"],
    ["floor() / ceil() / round(mode) / roundTo(places)", "rounding (bigint results)"],
    ["E(n)", "multiply by 10^n"],
    ["reciprocal() / negate() / abs()", ""],
  ],
  RationalInterval: [
    ["low / high", "endpoints"],
    ["add/subtract/multiply/divide(y), pow(n), mpow(n)", "interval arithmetic; mpow multiplies copies"],
    ["midpoint() / mediant()", "R`1:3`.midpoint() -> 2"],
    ["shortestDecimal()", "R`1/3:1/2`.shortestDecimal() -> 2/5"],
    ["contains(x) / containsValue(x) / overlaps(y)", "membership and overlap"],
    ["intersection(y) / union(y)", ""],
    ["relativeMidDecimalInterval() / compactedDecimalInterval()", "decimal interval text"],
    ["toRepeatingDecimal() / toMixedString()", ""],
  ],
};

/** Methods and short examples for a value (help(x)). */
export function describeMethods(value) {
  const type = value?.constructor?.name;
  const notes = METHOD_NOTES[type];
  const names = new Set();
  for (let proto = Object.getPrototypeOf(value ?? {}); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== "constructor" && !name.startsWith("_") && typeof Object.getOwnPropertyDescriptor(proto, name)?.value === "function") names.add(name);
    }
  }
  const all = [...names].sort();
  if (!notes) return all.length ? `${type ?? typeof value} methods: ${all.join(", ")}` : `${formatValue(value)} has no methods`;
  const width = Math.max(...notes.map(([name]) => name.length));
  return [`${type} ${formatValue(value, { mode: "exact" })}`, ...notes.map(([name, note]) => `  .${name.padEnd(width)}  ${note}`), `All methods: ${all.join(", ")}`].join("\n");
}

// --- session ---------------------------------------------------------------

/**
 * Create a calculator session. evaluate(source) returns
 * { ok: true, value, text } or { ok: false, error, text }.
 */
export function createSession(options = {}) {
  const settings = { mode: "both", digits: 30, sciDigits: 10, base: null };
  const variables = new Map();
  const blocked = new Set([...BLOCKED, ...(options.blocked ?? [])]);
  const actions = { clear: options.onClear ?? (() => {}) };

  const builtins = {
    ...Core,
    R: Core.R,
    help: (...args) => (args.length ? describeMethods(args[0]) : HELP_TEXT),
    display(mode) {
      if (mode === undefined) return settings.mode;
      if (!DISPLAY_MODES.includes(mode)) throw new Error(`display mode must be one of ${DISPLAY_MODES.join(", ")}`);
      settings.mode = mode;
      return `display ${mode}`;
    },
    sciDigits(n) {
      if (n === undefined) return settings.sciDigits;
      if (!Number.isSafeInteger(n) || n < 1 || n > 1000) throw new Error("sciDigits(n) needs a whole number from 1 to 1000");
      settings.sciDigits = n;
      return `sciDigits ${n}`;
    },
    base(radix) {
      if (radix === undefined) return settings.base ? `base ${settings.base.base}` : "base 10";
      const system = baseSystemOf(radix);
      settings.base = system.base === 10 && radix !== undefined && typeof radix !== "string" ? null : system;
      return settings.base ? `base ${system.base}` : "base 10";
    },
    // With a value: format it once. Without: show every result in that base too.
    hex: (...args) => (args.length ? formatInBase(args[0], 16) : builtins.base(16)),
    bin: (...args) => (args.length ? formatInBase(args[0], 2) : builtins.base(2)),
    oct: (...args) => (args.length ? formatInBase(args[0], 8) : builtins.base(8)),
    dec: (...args) => (args.length ? formatValue(args[0], { ...settings, mode: "decimal", base: null }) : builtins.base(10)),
    inBase: (value, radix) => formatInBase(value, radix),
    cf: (value) => (value instanceof Integer ? value.toRational() : value).toContinuedFractionString(),
    mix: (value) => value.toMixedString(),
    deci: (value, n = settings.digits) => formatValue(value, { ...settings, mode: "decimal", digits: n, base: null }),
    sci: (value, n = settings.sciDigits) => formatScientific(value, n),
    digits(n) {
      if (n === undefined) return settings.digits;
      if (!Number.isSafeInteger(n) || n < 1 || n > 10000) throw new Error("digits(n) needs a whole number from 1 to 10000");
      settings.digits = n;
      return `digits ${n}`;
    },
    vars: () => [...variables.keys()].filter((name) => name !== "ans").map((name) => `${name} = ${formatValue(variables.get(name), settings)}`).join("\n") || "(no variables)",
    clear() { variables.clear(); actions.clear(); return "cleared"; },
    show: (value) => formatValue(value, settings),
  };

  const scope = new Proxy(variables, {
    has(_target, name) {
      if (typeof name !== "string") return false;
      if (name === "eval" || name === "__ratcalcSource") return false;
      if (blocked.has(name) || variables.has(name) || Object.hasOwn(builtins, name)) return true;
      return !(name in globalThis);
    },
    get(_target, name) {
      if (name === Symbol.unscopables) return undefined;
      if (blocked.has(name)) throw new ReferenceError(`${String(name)} is not available in RatCalc`);
      if (variables.has(name)) return variables.get(name);
      if (Object.hasOwn(builtins, name)) return builtins[name];
      throw new ReferenceError(`${String(name)} is not defined`);
    },
    set(_target, name, value) {
      if (blocked.has(name)) throw new ReferenceError(`${String(name)} is not available in RatCalc`);
      variables.set(name, value);
      return true;
    },
    deleteProperty(_target, name) { return variables.delete(name); },
  });

  // Sloppy-mode Function so `with` is allowed; direct eval returns the
  // completion value of the last statement, like a console.
  // eslint-disable-next-line no-new-func
  const run = new Function("__ratcalcScope", "__ratcalcSource", "with (__ratcalcScope) { return eval(__ratcalcSource); }");

  function evaluate(source) {
    const code = String(source ?? "");
    try {
      if (/\bimport\s*[(\s{*]|\bimport\.meta\b|\bexport\s/.test(code.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, ""))) {
        throw new SyntaxError("import and export are not available in RatCalc");
      }
      const value = run(scope, rewriteDeclarations(code));
      if (value !== undefined) variables.set("ans", value);
      return { ok: true, value, text: formatValue(value, settings) };
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      return { ok: false, error, text: message };
    }
  }

  return { evaluate, settings, variables, format: (value) => formatValue(value, settings) };
}
