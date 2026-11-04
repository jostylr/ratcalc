import { expect, test } from "bun:test";

const cli = new URL("../index.js", import.meta.url).pathname;

test("-e evaluates one input", () => {
  const result = Bun.spawnSync([process.execPath, cli, "-e", "R`1:2 + 3`"]);
  expect(result.stdout.toString().trim()).toBe("4:5");
  expect(result.exitCode).toBe(0);
});

test("piped input runs line by line, with dot commands", () => {
  const result = Bun.spawnSync([process.execPath, cli], {
    stdin: new TextEncoder().encode("let x = R`1/3`\nR`${x} * 3`\n.vars\n.exit\nnot reached\n"),
  });
  expect(result.stdout.toString().trim().split("\n")).toEqual(["1/3 = 0.#3", "1", "x = 1/3 = 0.#3"]);
  expect(result.exitCode).toBe(0);
});

test("errors go to stderr and set the exit code", () => {
  const result = Bun.spawnSync([process.execPath, cli, "-e", "R`1/0`"]);
  expect(result.stderr.toString()).toContain("Division by zero");
  expect(result.exitCode).toBe(1);
});
