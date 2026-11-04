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

const DISPLAY_MODES = ["both", "exact", "decimal", "mixed", "cf"];

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

function formatRational(value, mode, digits) {
  const exact = value.toString();
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
  const { mode = "both", digits = 30, depth = 0 } = options;
  if (value instanceof Rational) return formatRational(value, mode, digits);
  if (value instanceof Integer) return value.toString();
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
  const inner = { mode: mode === "both" ? "exact" : mode, digits, depth: depth + 1 };
  if (Array.isArray(value)) return `[${value.map((item) => formatValue(item, inner)).join(", ")}]`;
  if (value instanceof Map) return `Map {${[...value].map(([k, v]) => `${formatValue(k, inner)} => ${formatValue(v, inner)}`).join(", ")}}`;
  if (value instanceof Set) return `Set {${[...value].map((item) => formatValue(item, inner)).join(", ")}}`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  const entries = Object.entries(value);
  return `{${entries.map(([k, v]) => `${k}: ${formatValue(v, inner)}`).join(", ")}}`;
}

// --- help ------------------------------------------------------------------

export const HELP_TEXT = `RatCalc is JavaScript with exact rational arithmetic.
Type any JavaScript; the last expression's value is shown.

  R\`1/3 + 1/6\`            exact arithmetic on Core literals -> 1/2
  R\`1:2 + 3\`              intervals -> 4:5
  x = R\`2/3\`; R\`\${x}^2\`  interpolated values stay exact -> 4/9
  new Rational(1, 7)       Core classes: Integer, Rational, RationalInterval, ...
  parseNumber("0.#142857") Core parsers: parseNumber, parseInterval, ...
  [1, 2, 3].map(n => R\`1/\${n}\`)  plain JavaScript works around R
  let total = R\`0\`         declarations persist between inputs
  ans                      the previous result

R literals: 3, -2, 1/2, 1..3/4, 0.#3, 1.23[56:67], 1_000, 1.5? ; operators + - * / ^ ! :
Display: display("both" | "exact" | "decimal" | "mixed" | "cf"), digits(n)
Commands: help(), vars(), clear()   (terminal: .help .vars .clear .exit)
JavaScript numbers like 0.1 are inexact; results that are plain numbers say so.`;

// --- session ---------------------------------------------------------------

/**
 * Create a calculator session. evaluate(source) returns
 * { ok: true, value, text } or { ok: false, error, text }.
 */
export function createSession(options = {}) {
  const settings = { mode: "both", digits: 30 };
  const variables = new Map();
  const blocked = new Set([...BLOCKED, ...(options.blocked ?? [])]);
  const actions = { clear: options.onClear ?? (() => {}) };

  const builtins = {
    ...Core,
    R: Core.R,
    help: () => HELP_TEXT,
    display(mode) {
      if (mode === undefined) return settings.mode;
      if (!DISPLAY_MODES.includes(mode)) throw new Error(`display mode must be one of ${DISPLAY_MODES.join(", ")}`);
      settings.mode = mode;
      return `display ${mode}`;
    },
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
