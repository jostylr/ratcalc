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
