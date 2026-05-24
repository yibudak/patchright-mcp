#!/usr/bin/env node
'use strict';

// Load-bearing gate for the auto-upstream-upgrade workflow. A passing
// `require('./index.js')` is not enough: an upstream symbol can be re-exported
// as `undefined` (no throw) and still crash at call time. So assert each symbol
// index.js consumes resolves to the expected type before we publish. See #1.
const checks = [
  {
    module: 'patchright-core/lib/utilsBundle',
    symbol: 'program',
    type: 'object',
    methods: ['version', 'name', 'parseAsync'],
  },
  {
    module: 'patchright-core/lib/tools/mcp/program',
    symbol: 'decorateMCPCommand',
    type: 'function',
  },
];

const fs = require('fs');

const failures = [];
const lines = [];

for (const check of checks) {
  let mod;
  try {
    mod = require(check.module);
  } catch (err) {
    const code = err.code || err.message;
    failures.push(`${check.module}: require failed (${code})`);
    lines.push(`- ❌ \`${check.module}\` — require failed: \`${code}\``);
    continue;
  }

  const value = mod[check.symbol];
  const actualType = value === null ? 'null' : typeof value;
  if (actualType !== check.type) {
    failures.push(`${check.module}#${check.symbol}: got ${actualType}, expected ${check.type}`);
    lines.push(`- ❌ \`${check.symbol}\` from \`${check.module}\` — got \`${actualType}\`, expected \`${check.type}\``);
    continue;
  }

  const missing = (check.methods || []).filter((m) => typeof value[m] !== 'function');
  if (missing.length) {
    failures.push(`${check.module}#${check.symbol}: missing method(s) ${missing.join(', ')}`);
    lines.push(`- ❌ \`${check.symbol}\` from \`${check.module}\` — missing method(s): \`${missing.join('`, `')}\``);
    continue;
  }

  const detail = check.methods ? `, methods: ${check.methods.join(', ')}` : '';
  lines.push(`- ✅ \`${check.symbol}\` from \`${check.module}\` (\`${check.type}\`${detail})`);
}

let coreVersion = 'unknown';
try {
  coreVersion = require('patchright-core/package.json').version;
} catch {
  // version is best-effort context for the report; absence is not itself a gate failure
}

const report = `### Symbol-presence gate — patchright-core@${coreVersion}\n${lines.join('\n')}\n`;
process.stdout.write(report + '\n');
fs.writeFileSync('gate-report.md', report);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
}

if (failures.length) {
  console.error(`Symbol-presence gate FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('Symbol-presence gate passed.');
