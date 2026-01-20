import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Calculator } from "../index.js";

class TestCalculator extends Calculator {
    constructor() {
        const logs = [];
        super((...args) => logs.push(args.join(" ")));
        this.logs = logs;
    }
    start() { }
    setupReadline() { }
    close() { this.rl.close(); }
    getLastLog() {
        const validLogs = this.logs.filter(l => !l.startsWith("Parser Debug"));
        if (validLogs.length === 0) return undefined;
        return validLogs[validLogs.length - 1];
    }
    getAllLogs() {
        return this.logs.filter(l => !l.startsWith("Parser Debug"));
    }
    clearLogs() { this.logs.length = 0; }
    
    // Async version of runCommand for LOAD commands
    async runCommandAsync(input) {
        const upperInput = input.toUpperCase().trim();
        if (upperInput.startsWith("LOAD ")) {
            await this.handleLoadCommand(input.substring(5).trim());
            return;
        }
        this.runCommand(input);
    }
}

describe("Calc: Oracles Integration", () => {
    let calc;
    beforeEach(() => { calc = new TestCalculator(); });
    afterEach(() => { calc.close(); });

    test("LOAD oracles command works", async () => {
        await calc.runCommandAsync("LOAD oracles");
        const log = calc.getLastLog();
        expect(log).toContain("Oracles");
        expect(log).toContain("loaded");
    });

    test("Sqrt(2) creates an oracle", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("s = Sqrt(2)");
        const log = calc.getLastLog();
        // Should not contain error messages
        expect(log).not.toContain("Invalid");
        expect(log).not.toContain("Error");
        expect(log).not.toContain("Failed");
    });

    test("Sqrt(2) returns an oracle with yes interval", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("Sqrt(2)");
        const log = calc.getLastLog();
        // Should display oracle info
        expect(log).not.toContain("Invalid");
        expect(log).not.toContain("Error");
        // Oracle should display with yes interval
        expect(log).toContain("Oracle");
    });

    test("Oracle(2) creates an oracle from number", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("Oracle(2)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Invalid");
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("OracleAdd(2, 4) works with raw numbers", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("OracleAdd(2, 4)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Invalid");
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("NRoot(8, 3) computes cube root", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("NRoot(8, 3)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Invalid");
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("CFSqrt2() creates continued fraction oracle", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("CFSqrt2()");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("CFE() creates e oracle", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("CFE()");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("CFPhi() creates golden ratio oracle", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("CFPhi()");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("OracleYes returns the yes interval", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("a = Oracle(5)");
        calc.clearLogs();
        calc.runCommand("OracleYes(a)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        // Should show an interval containing 5
        expect(log).toContain("5");
    });

    test("Oracle arithmetic: OracleMul", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("OracleMul(3, 4)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("Oracle arithmetic: OracleSub", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("OracleSub(10, 3)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("Oracle arithmetic: OracleDiv", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("OracleDiv(10, 2)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("Oracle arithmetic: OracleNeg", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("OracleNeg(5)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("Assigning oracle to variable works", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("a = Sqrt(2)");
        expect(calc.getLastLog()).not.toContain("Error");
        
        calc.clearLogs();
        calc.runCommand("b = Sqrt(3)");
        expect(calc.getLastLog()).not.toContain("Error");
    });

    test("Sqrt with fraction input", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("Sqrt(1/2)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Invalid");
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    // Tests for Ask function - verifying oracle Yes/No responses
    test("Ask returns 1 (Yes) when oracle value is in interval", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        // Oracle(5) represents exactly 5, asking if it's in [4, 6] should be Yes
        calc.runCommand("o = Oracle(5)");
        calc.clearLogs();
        
        // Ask if 5 is in the interval 4:6
        const result = calc.variableManager.evaluateExpression("Ask(o, 4:6)");
        // Result should be a Promise
        expect(result.result).toBeDefined();
        expect(typeof result.result.then).toBe('function');
        
        const answer = await result.result;
        expect(answer).toBe(1); // Yes
    });

    test("Ask returns 0 (No) when oracle value is outside interval", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        // Oracle(5) represents exactly 5, asking if it's in [10, 20] should be No
        calc.runCommand("o = Oracle(5)");
        calc.clearLogs();
        
        const result = calc.variableManager.evaluateExpression("Ask(o, 10:20)");
        expect(result.result).toBeDefined();
        expect(typeof result.result.then).toBe('function');
        
        const answer = await result.result;
        expect(answer).toBe(0); // No
    });

    test("Ask with Sqrt(2) - should be Yes for interval containing sqrt(2)", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        // Sqrt(2) ≈ 1.414..., asking if it's in [1, 2] should be Yes
        calc.runCommand("s = Sqrt(2)");
        calc.clearLogs();
        
        const result = calc.variableManager.evaluateExpression("Ask(s, 1:2)");
        expect(result.result).toBeDefined();
        expect(typeof result.result.then).toBe('function');
        
        const answer = await result.result;
        expect(answer).toBe(1); // Yes - sqrt(2) is in [1, 2]
    });

    test("Ask with Sqrt(2) - should be No for interval not containing sqrt(2)", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        // Sqrt(2) ≈ 1.414..., asking if it's in [2, 3] should be No
        calc.runCommand("s = Sqrt(2)");
        calc.clearLogs();
        
        const result = calc.variableManager.evaluateExpression("Ask(s, 2:3)");
        expect(result.result).toBeDefined();
        expect(typeof result.result.then).toBe('function');
        
        const answer = await result.result;
        expect(answer).toBe(0); // No - sqrt(2) is not in [2, 3]
    });

    test("Narrow function returns refined interval", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        // Narrow Sqrt(2) should return a refined RationalInterval
        calc.runCommand("s = Sqrt(2)");
        calc.clearLogs();
        
        const result = calc.variableManager.evaluateExpression("Narrow(s)");
        expect(result.result).toBeDefined();
        expect(typeof result.result.then).toBe('function');
        
        const interval = await result.result;
        // The narrowed interval should contain sqrt(2) ≈ 1.414...
        expect(interval).toBeDefined();
        // Check it's a RationalInterval with low and high
        expect(interval.low).toBeDefined();
        expect(interval.high).toBeDefined();
    });

    test("Estimate returns terminating decimal (power of 10 denominator)", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("s = Sqrt(2)");
        calc.clearLogs();
        
        const result = calc.variableManager.evaluateExpression("Estimate(s)");
        expect(result.result).toBeDefined();
        expect(typeof result.result.then).toBe('function');
        
        const estimate = await result.result;
        // Should return a Rational (terminating decimal)
        expect(estimate.numerator).toBeDefined();
        expect(estimate.denominator).toBeDefined();
        // Value should be close to sqrt(2) ≈ 1.414
        const numVal = Number(estimate.numerator) / Number(estimate.denominator);
        expect(numVal).toBeGreaterThan(1.4);
        expect(numVal).toBeLessThan(1.5);
        // Denominator should only have factors of 2 and 5 (terminating decimal)
        let d = estimate.denominator;
        while (d % 2n === 0n) d = d / 2n;
        while (d % 5n === 0n) d = d / 5n;
        expect(d).toBe(1n);
    });

    test("Midpoint returns exact midpoint as Rational", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("s = Sqrt(2)");
        calc.clearLogs();
        
        const result = calc.variableManager.evaluateExpression("Midpoint(s)");
        expect(result.result).toBeDefined();
        expect(typeof result.result.then).toBe('function');
        
        const midpoint = await result.result;
        expect(midpoint.numerator).toBeDefined();
        expect(midpoint.denominator).toBeDefined();
        const numVal = Number(midpoint.numerator) / Number(midpoint.denominator);
        expect(numVal).toBeGreaterThan(1.4);
        expect(numVal).toBeLessThan(1.5);
    });

    test("Mediant returns simplest Farey fraction in interval", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("s = Sqrt(2)");
        calc.clearLogs();
        
        const result = calc.variableManager.evaluateExpression("Mediant(s)");
        expect(result.result).toBeDefined();
        expect(typeof result.result.then).toBe('function');
        
        const mediant = await result.result;
        expect(mediant.numerator).toBeDefined();
        expect(mediant.denominator).toBeDefined();
        const numVal = Number(mediant.numerator) / Number(mediant.denominator);
        expect(numVal).toBeGreaterThan(1.4);
        expect(numVal).toBeLessThan(1.5);
    });

    test("Estimate with custom precision", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("s = Sqrt(2)");
        calc.clearLogs();
        
        // Estimate with precision 1/1000000 (0.000001)
        const result = calc.variableManager.evaluateExpression("Estimate(s, 1/1000000)");
        expect(result.result).toBeDefined();
        expect(typeof result.result.then).toBe('function');
        
        const estimate = await result.result;
        // Should return a Rational (terminating decimal)
        expect(estimate.numerator).toBeDefined();
        // With higher precision, value should be closer to sqrt(2)
        const numVal = Number(estimate.numerator) / Number(estimate.denominator);
        expect(numVal).toBeGreaterThan(1.41421);
        expect(numVal).toBeLessThan(1.41422);
        // Denominator should only have factors of 2 and 5 (terminating decimal)
        let d = estimate.denominator;
        while (d % 2n === 0n) d = d / 2n;
        while (d % 5n === 0n) d = d / 5n;
        expect(d).toBe(1n);
    });

    test("Oracle arithmetic with variable: c+c", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("c = Sqrt(2)");
        calc.clearLogs();
        
        // c+c should work (was giving "intermediateExpr is not defined" error)
        calc.runCommand("c+c");
        const log = calc.getLastLog();
        expect(log).not.toContain("not defined");
        expect(log).not.toContain("Error");
    });

    test("Oracle arithmetic: oracle + rational", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("c = Sqrt(2)");
        calc.clearLogs();
        
        // Adding oracle to number should work
        calc.runCommand("OracleAdd(c, 1)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("Async assignment: d = Estimate(...) stores resolved value", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("s = Sqrt(2)");
        calc.clearLogs();
        
        // Test that async assignment returns the right type
        const result = calc.variableManager.handleAssignment("d", "Estimate(s)");
        expect(result.type).toBe("async_assignment");
        expect(result.varName).toBe("d"); // lowercase variable name
        expect(typeof result.promise.then).toBe("function");
        
        // Await and verify the resolved value is a Rational (terminating decimal)
        const resolved = await result.promise;
        expect(resolved.numerator).toBeDefined();
        expect(resolved.denominator).toBeDefined();
        const numVal = Number(resolved.numerator) / Number(resolved.denominator);
        expect(numVal).toBeGreaterThan(1.4);
        expect(numVal).toBeLessThan(1.5);
        // Denominator should only have factors of 2 and 5 (terminating decimal)
        let d = resolved.denominator;
        while (d % 2n === 0n) d = d / 2n;
        while (d % 5n === 0n) d = d / 5n;
        expect(d).toBe(1n);
    });
});
