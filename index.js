#!/usr/bin/env bun
/**
 * RatCalc (terminal): a JavaScript REPL with exact rational arithmetic.
 *
 *   bun apps/calc/index.js                 interactive
 *   bun apps/calc/index.js -e 'R`1:2 + 3`' evaluate and print
 *   echo 'R`1/3 + 1/6`' | bun apps/calc/index.js
 */
import { createInterface } from "node:readline";
import { createSession, HELP_TEXT } from "./src/session.js";

/** Run one input line, handling dot commands; returns the text to print. */
export function runLine(session, line) {
  const input = line.trim();
  if (!input) return null;
  if (input === ".help" || input === "help") return { ok: true, text: HELP_TEXT };
  if (input === ".vars") return session.evaluate("vars()");
  if (input === ".clear") return session.evaluate("clear()");
  return session.evaluate(line);
}

function print(result) {
  if (!result) return;
  if (result.ok) console.log(result.text);
  else console.error(result.text);
}

async function main(argv) {
  const session = createSession();
  const expression = argv.indexOf("-e");
  if (expression !== -1) {
    const result = runLine(session, argv[expression + 1] ?? "");
    print(result);
    process.exit(result && !result.ok ? 1 : 0);
  }

  const interactive = process.stdin.isTTY;
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "> ", terminal: interactive });
  if (interactive) {
    console.log("RatCalc — JavaScript with exact rational arithmetic. Try R`1:2 + 3`; .help for help, .exit to quit.");
    rl.prompt();
  }
  let failed = false;
  for await (const line of rl) {
    if (line.trim() === ".exit") break;
    const result = runLine(session, line);
    if (result && !result.ok) failed = true;
    print(result);
    if (interactive) rl.prompt();
  }
  rl.close();
  if (!interactive && failed) process.exitCode = 1;
}

if (import.meta.main) await main(process.argv.slice(2));
