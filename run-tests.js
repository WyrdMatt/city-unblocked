/**
 * run-tests.js
 *
 * Single entry point for all City Unblocked test suites.
 * Runs each suite as a child process and aggregates results.
 *
 *   node run-tests.js
 *
 * Exit code 0 = all suites passed, 1 = one or more failures.
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  { file: 'test-mapgen.js',  args: ['--runs', '5000'] },
  { file: 'test-effects.js', args: [] },
  { file: 'test-balance.js', args: [] },
];

let totalPassed = 0, totalFailed = 0;
const failedSuites = [];

console.log('\n══════════════════════════════════════════════\n  City Unblocked — full test run\n══════════════════════════════════════════════\n');

for (const suite of SUITES) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, suite.file), ...suite.args],
    { encoding: 'utf8' }
  );

  process.stdout.write(result.stdout || '');
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status === 0) {
    totalPassed++;
  } else {
    totalFailed++;
    failedSuites.push(suite.file);
  }
}

console.log('══════════════════════════════════════════════');
console.log(`  Suites:  ${totalPassed} passed  /  ${totalFailed} failed  /  ${SUITES.length} total`);
if (failedSuites.length) {
  console.error(`  Failed:  ${failedSuites.join(', ')}`);
}
console.log('══════════════════════════════════════════════\n');

process.exit(totalFailed > 0 ? 1 : 0);
