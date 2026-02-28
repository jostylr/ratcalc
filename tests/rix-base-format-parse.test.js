import { describe, it, expect } from "bun:test";
import { VariableManager } from "@ratmath/algebra";

describe("RiX Base Formatting/Parsing", () => {
  it("defines uppercase base prefixes once", () => {
    const vm = new VariableManager();
    const res = vm.processInput('0A = "0123456789ABCDEF"');
    expect(res.type).toBe("assignment");
    const again = vm.processInput('0A = "01"');
    expect(again.type).toBe("error");
  });

  it("formats with _> and parses with <_", () => {
    const vm = new VariableManager();
    vm.processInput('0A = "0123456789ABCDEF"');

    const b = vm.processInput("5 _> 0b");
    expect(b.type).toBe("expression");
    expect(b.result).toEqual({ type: "string", value: "101" });

    const a = vm.processInput("74 _> 0A");
    expect(a.type).toBe("expression");
    expect(a.result).toEqual({ type: "string", value: "4A" });

    const p = vm.processInput('"101" <_ 0b');
    expect(p.type).toBe("expression");
    expect(p.result.toString()).toBe("5");

    const tupleBase = vm.processInput('5 _> {: 2, "01"}');
    expect(tupleBase.type).toBe("expression");
    expect(tupleBase.result).toEqual({ type: "string", value: "101" });
  });

  it("supports quoted and unquoted prefixed literals", () => {
    const vm = new VariableManager();
    vm.processInput('0A = "0123456789ABCDEF"');

    const unquoted = vm.processInput("0A4A.F");
    expect(unquoted.type).toBe("expression");
    expect(unquoted.result.toString()).toBe("1199/16");

    const quoted = vm.processInput('0A"4A.F"');
    expect(quoted.type).toBe("expression");
    expect(quoted.result.toString()).toBe("1199/16");
  });

  it("supports mode aliases", () => {
    const vm = new VariableManager();

    const mixed = vm.processInput('1.#3 _> ".."');
    expect(mixed.type).toBe("expression");
    expect(mixed.result).toEqual({ type: "string", value: "1..1/3" });

    const repeat = vm.processInput('4/3 _> "."');
    expect(repeat.type).toBe("expression");
    expect(repeat.result).toEqual({ type: "string", value: "1.#3" });

    const improper = vm.processInput('1.#3 _> "/"');
    expect(improper.type).toBe("expression");
    expect(improper.result).toEqual({ type: "string", value: "4/3" });
  });

  it("groups digits after radix point and in shifted mode", () => {
    const vm = new VariableManager();
    const shifted = vm.processInput('1231234.2134213421 _> "^"');
    expect(shifted.type).toBe("expression");
    expect(shifted.result.type).toBe("string");
    expect(shifted.result.value).toContain("1.231_234_213_421_342_1");
    expect(shifted.result.value).toMatch(/_\^6$/);
  });

  it("shortens very long repeating expansions in repeat mode", () => {
    const vm = new VariableManager();
    const longRepeat = vm.processInput("1/97 _> \".\"");
    expect(longRepeat.type).toBe("expression");
    expect(longRepeat.result.type).toBe("string");
    expect(longRepeat.result.value).toContain("...");
  });

  it("supports tuple mode with named base prefixes", () => {
    const vm = new VariableManager();
    const builtin = vm.processInput('-9/7 _> (0b, "~")');
    expect(builtin.type).toBe("expression");
    expect(builtin.result).toEqual({ type: "string", value: "~-10.~1~10~10" });

    vm.processInput('0W = "01"');
    const custom = vm.processInput('-9/7 _> (0W, "~")');
    expect(custom.type).toBe("expression");
    expect(custom.result).toEqual({ type: "string", value: "~-10.~1~10~10" });
  });

  it("allows defining uppercase prefixes even when lowercase builtins exist", () => {
    const vm = new VariableManager();
    const b = vm.processInput('0B = "01"');
    expect(b.type).toBe("assignment");
    const o = vm.processInput('0O = "01234567"');
    expect(o.type).toBe("assignment");
  });
});
