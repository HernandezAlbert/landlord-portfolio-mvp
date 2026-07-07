import assert from "node:assert/strict";

import { formatGBPFromPence, poundsToPence } from "../lib/money";

const examples = [
  { input: 79, expected: "£79.00" },
  { input: 21, expected: "£21.00" },
  { input: 115, expected: "£115.00" },
  { input: 534.48, expected: "£534.48" },
  { input: 8500, expected: "£8,500.00" },
];

for (const example of examples) {
  assert.equal(
    formatGBPFromPence(poundsToPence(example.input)),
    example.expected,
  );
}

console.log("Money validation passed.");
