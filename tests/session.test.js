import { describe, expect, test } from "bun:test";
import { Integer, Rational, RationalInterval } from "@ratmath/core";
import { createSession, formatValue, rewriteDeclarations } from "../src/session.js";

const run = (session, code) => {
  const result = session.evaluate(code);
  if (!result.ok) throw result.error;
  return result;
};

describe("JavaScript with Core in scope", () => {
  test("R gives exact values and displays them exactly", () => {
    const s = createSession();
    expect(run(s, "R`1:2 + 3`").text).toBe("4:5");
    expect(run(s, "R`1/3 + 1/6`").text).toBe("1/2 = 0.5");
    expect(run(s, "R`1/7`").text).toBe("1/7 = 0.#142857");
    expect(run(s, "R`2^10`").value).toBeInstanceOf(Integer);
    expect(run(s, "new Rational(3, 4)").text).toBe("3/4 = 0.75");
    expect(run(s, "parseInterval('1/3:1/2')").text).toBe("1/3:1/2 = 0.#3:0.5");
  });

  test("declarations persist between inputs and ans holds the last result", () => {
    const s = createSession();
    run(s, "let x = R`1/3`");
    run(s, "const half = R`1/2`; var n = 3");
    expect(run(s, "R`${x} + ${half}`").text).toBe("5/6 = 0.8#3");
    expect(run(s, "ans").value.equals(new Rational(5, 6))).toBe(true);
    run(s, "function Inv(k) { return R`1/${k}` }");
    expect(run(s, "[1, 2, n].map(Inv)").text).toBe("[1, 1/2, 1/3]");
    run(s, "const { a, b } = { a: R`1/4`, b: 2 }");
    expect(run(s, "R`${a} * ${b}`").text).toBe("1/2 = 0.5");
    run(s, "let [p, q] = [1n, 2n]");
    expect(run(s, "p + q").text).toBe("3n");
    run(s, "class Box { constructor(v) { this.v = v } }");
    expect(run(s, "new Box(R`1/2`)").text).toBe("{v: 1/2}");
  });

  test("strings, comments and nested blocks are not rewritten", () => {
    expect(rewriteDeclarations('s = "let x = 1"; // let y = 2')).toBe('s = "let x = 1"; // let y = 2');
    expect(rewriteDeclarations("let a = `let ${1}`")).toBe("a = `let ${1}`");
    expect(rewriteDeclarations("if (1) { let inner = 2 }")).toBe("if (1) { let inner = 2 }");
    expect(rewriteDeclarations("/* let c = 1 */ let d = 2")).toBe("/* let c = 1 */ d = 2");
  });

  test("plain JavaScript numbers are labelled inexact", () => {
    const s = createSession();
    expect(run(s, "0.1 + 0.2").text).toContain("inexact JS number");
    expect(run(s, "2 + 2").text).toBe("4");
    expect(run(s, "Math.max(3, 4)").text).toBe("4");
  });

  test("display modes and digits", () => {
    const s = createSession();
    run(s, 'display("mixed")');
    expect(run(s, "R`7/4`").text).toBe("1..3/4");
    run(s, 'display("decimal")');
    expect(run(s, "R`1/8`").text).toBe("0.125");
    run(s, 'display("exact")');
    expect(run(s, "R`1/8`").text).toBe("1/8");
    run(s, 'display("cf")');
    expect(run(s, "R`7/4`").text).toBe(new Rational(7, 4).toContinuedFractionString());
    expect(run(s, "display()").text).toBe("cf");
    expect(() => run(s, 'display("hex")')).toThrow("display mode");
    expect(() => run(s, "digits(0)")).toThrow("digits");
    expect(run(s, "digits(5)").text).toBe("digits 5");
  });

  test("vars, clear and help", () => {
    let cleared = 0;
    const s = createSession({ onClear: () => { cleared += 1; } });
    run(s, "let x = R`2`");
    expect(run(s, "vars()").text).toBe("x = 2");
    run(s, "clear()");
    expect(cleared).toBe(1);
    expect(run(s, "vars()").text).toBe("(no variables)");
    expect(run(s, "help()").text).toContain("R`1:2 + 3`");
  });

  test("network, imports and host escapes are unavailable", () => {
    const s = createSession();
    for (const code of ["fetch('https://example.com')", "globalThis", "window", "process.env", "document"]) {
      expect(s.evaluate(code).text).toContain("not available in RatCalc");
    }
    expect(s.evaluate("fetch = 1").text).toContain("not available in RatCalc");
    expect(s.evaluate('import("./x.js")').text).toContain("import and export are not available");
    expect(s.evaluate("export const z = 1").ok).toBe(false);
    expect(s.evaluate('"import(x) in a string"').ok).toBe(true);
  });

  test("errors are reported, not thrown", () => {
    const s = createSession();
    expect(s.evaluate("R`1/0`").ok).toBe(false);
    expect(s.evaluate("missingName").text).toContain("missingName is not defined");
    expect(s.evaluate("(").text).toContain("SyntaxError");
  });
});

describe("old calculator features, in JavaScript", () => {
  test("RiX-spelled literals inside R", () => {
    const s = createSession();
    expect(run(s, "R`3.~7~15~1`").text.startsWith("355/113")).toBe(true);
    expect(run(s, "R`2.5_^-2`").text).toBe("1/40 = 0.025");
    expect(run(s, "R`0xff.8`").text).toBe("511/2 = 255.5");
    expect(run(s, "R.base(16)`ff.8 / 3`").text).toBe("511/6 = 85.1#6");
    expect(run(s, "R`5!!`").text).toBe("15");
  });

  test("sums, products and sequences replace SUM, PROD and SEQ", () => {
    const s = createSession();
    expect(run(s, "sum(1, 10, i => R`${i}^2`)").text).toBe("385");
    expect(run(s, "product(1, 5, j => j)").text).toBe("120");
    expect(run(s, "seq(0, 5, 2, k => R`${k}^3`)").text).toBe("[0, 8, 64]");
    expect(run(s, "sum([R`1/2`, R`1/3`])").text).toBe("5/6 = 0.8#3");
  });

  test("range and seq give ExactLists with list arithmetic", () => {
    const s = createSession();
    run(s, "xs = range(1, 4)");
    expect(run(s, "xs").text).toBe("[1, 2, 3, 4]");
    expect(run(s, "xs.sum()").text).toBe("10");
    expect(run(s, "xs.multiply(R`1/2`)").text).toBe("[1/2, 1, 3/2, 2]");
    expect(run(s, "xs.pow(-1).sum()").text).toBe("25/12 = 2.08#3");
    expect(run(s, "xs.filter(x => x.isEven()).product()").text).toBe("8");
    expect(run(s, 'exact(["1/2", 3]).max()').text).toBe("3");
    const notes = run(s, "help(xs)").text;
    expect(notes).toContain("ExactList [1, 2, 3, 4]");
    expect(notes).toContain("multiply/divide(c)");
  });

  test("one-value formatters", () => {
    const s = createSession();
    expect(run(s, "hex(R`255`)").text).toBe("0xff");
    expect(run(s, "bin(R`1/3`)").text).toBe("0b0.#01");
    expect(run(s, "oct(R`-9`)").text).toBe("-0o11");
    expect(run(s, "inBase(R`1:2`, 2)").text).toBe("0b1:0b10");
    expect(run(s, "inBase(R`10`, 13)").text).toBe("0z[13]a");
    expect(run(s, "cf(R`355/113`)").text).toBe("3.~7~16");
    expect(run(s, "cf(R`3`)").text).toBe("3.~0");
    expect(run(s, "mix(R`22/7`)").text).toBe("3..1/7");
    expect(run(s, "deci(R`1/8`)").text).toBe("0.125");
    expect(run(s, "dec(R`1/8`)").text).toBe("0.125");
    expect(run(s, "sci(R`1/6`, 5)").text).toBe("1.6667_^-1…");
    expect(run(s, "sci(R`1/8`)").text).toBe("1.25_^-1");
    expect(run(s, "sci(R`99999`, 2)").text).toBe("1_^5…");
    expect(run(s, "sci(R`0`)").text).toBe("0");
    expect(run(s, "sci(R`1:2`)").text).toBe("1:2");
    expect(() => run(s, "inBase([1], 2)")).toThrow("base formatting needs");
    expect(() => run(s, "sci('x')")).toThrow("scientific formatting needs");
    expect(() => run(s, "inBase(R`1`, 1.5)")).toThrow("a base is a radix");
  });

  test("a persistent output base and scientific display", () => {
    const s = createSession();
    expect(run(s, "hex()").text).toBe("base 16");
    expect(run(s, "R`255`").text).toBe("0xff = 255");
    expect(run(s, "R`4/3`").text).toBe("0x1.#5 = 4/3 = 1.#3");
    expect(run(s, "[R`10`, R`1/2`]").text).toBe("[0xa, 0x0.8]");
    expect(run(s, "base()").text).toBe("base 16");
    expect(run(s, 'base("01")').text).toBe("base 2");
    expect(run(s, "bin()").text).toBe("base 2");
    expect(run(s, "oct()").text).toBe("base 8");
    expect(run(s, "dec()").text).toBe("base 10");
    expect(run(s, "base()").text).toBe("base 10");
    expect(run(s, "R`255`").text).toBe("255");
    run(s, 'display("sci")');
    expect(run(s, "R`1/3`").text).toBe("3.333333333_^-1…");
    expect(run(s, "R`5`").text).toBe("5");
    run(s, "sciDigits(3)");
    expect(run(s, "R`1/3:2/3`").text).toBe("3.33_^-1…:6.67_^-1…");
    expect(run(s, "sciDigits()").text).toBe("3");
    expect(() => run(s, "sciDigits(0)")).toThrow("sciDigits");
  });

  test("help(x) lists what a value can do", () => {
    const s = createSession();
    const rational = run(s, "help(R`355/113`)").text;
    expect(rational).toContain("Rational 355/113");
    expect(rational).toContain("convergents()");
    expect(rational).toContain("All methods:");
    expect(run(s, "help(R`7`)").text).toContain("factorial()");
    expect(run(s, "help(R`1:2`)").text).toContain("midpoint()");
    expect(run(s, "help([1])").text).toContain("Array methods:");
    expect(run(s, "help(Object.create(null))").text).toContain("has no methods");
    expect(run(s, "R`314159/100000`.bestApproximation(100)").text).toBe("311/99 = 3.#14");
  });
});

describe("formatValue", () => {
  test("collections, intervals and other JavaScript values", () => {
    const interval = new RationalInterval(new Rational(1), new Rational(2));
    expect(formatValue(interval)).toBe("1:2");
    expect(formatValue([new Rational(1, 2), "a", 3])).toBe('[1/2, "a", 3]');
    expect(formatValue(new Map([["k", new Integer(1)]]))).toBe('Map {"k" => 1}');
    expect(formatValue(new Set([1]))).toBe("Set {1}");
    expect(formatValue(null)).toBe("null");
    expect(formatValue(undefined)).toBe("undefined");
    expect(formatValue(true)).toBe("true");
    expect(formatValue(new Error("x"))).toBe("Error: x");
    expect(formatValue([[[[[1]]]]])).toBe("[[[[[…]]]]]");
  });
});
