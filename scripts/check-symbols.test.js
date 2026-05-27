const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(__dirname, 'check-symbols.js');

describe('check-symbols.js', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-symbols-test-'));

  before(() => {
    const reportPath = path.join(REPO_ROOT, 'gate-report.md');
    if (fs.existsSync(reportPath)) {
      fs.rmSync(reportPath);
    }
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const reportPath = path.join(REPO_ROOT, 'gate-report.md');
    if (fs.existsSync(reportPath)) {
      fs.rmSync(reportPath);
    }
  });

  test('exits_with_zero_when_all_symbols_present', () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('Symbol-presence gate passed'));
  });

  test('creates_gate_report_md_in_cwd', () => {
    spawnSync(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    const reportPath = path.join(REPO_ROOT, 'gate-report.md');
    assert.ok(fs.existsSync(reportPath));
    const report = fs.readFileSync(reportPath, 'utf8');
    assert.ok(report.includes('✅'));
    assert.ok(report.includes('patchright-core@'));
  });

  test('appends_to_github_step_summary_when_env_set', () => {
    const summaryFile = path.join(tmpDir, 'github-summary.md');
    fs.writeFileSync(summaryFile, 'existing-content\n');
    spawnSync(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      env: { ...process.env, GITHUB_STEP_SUMMARY: summaryFile },
    });
    const summary = fs.readFileSync(summaryFile, 'utf8');
    assert.ok(summary.startsWith('existing-content\n'));
    assert.ok(summary.includes('Symbol-presence gate'));
    assert.ok(summary.includes('✅'));
  });

  test('exits_with_non_zero_when_symbol_missing', () => {
    const wrapper = path.join(tmpDir, 'wrapper-missing.js');
    fs.writeFileSync(
      wrapper,
      `
      const Module = require('module');
      const orig = Module.prototype.require;
      Module.prototype.require = function(id) {
        if (id === 'patchright-core/lib/utilsBundle') return {};
        return orig.apply(this, arguments);
      };
      require(${JSON.stringify(SCRIPT)});
      `
    );
    const result = spawnSync(process.execPath, [wrapper], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    assert.notStrictEqual(result.status, 0);
    assert.ok(result.stderr.includes('Symbol-presence gate FAILED'));
  });

  test('exits_with_non_zero_when_symbol_has_wrong_type', () => {
    const wrapper = path.join(tmpDir, 'wrapper-wrong-type.js');
    fs.writeFileSync(
      wrapper,
      `
      const Module = require('module');
      const orig = Module.prototype.require;
      Module.prototype.require = function(id) {
        if (id === 'patchright-core/lib/utilsBundle') return { program: 'not-an-object' };
        return orig.apply(this, arguments);
      };
      require(${JSON.stringify(SCRIPT)});
      `
    );
    const result = spawnSync(process.execPath, [wrapper], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    assert.notStrictEqual(result.status, 0);
    assert.ok(result.stderr.includes('got string, expected object'));
  });

  test('exits_with_non_zero_when_method_missing', () => {
    const wrapper = path.join(tmpDir, 'wrapper-missing-method.js');
    fs.writeFileSync(
      wrapper,
      `
      const Module = require('module');
      const orig = Module.prototype.require;
      Module.prototype.require = function(id) {
        if (id === 'patchright-core/lib/utilsBundle') {
          return { program: { version: () => {}, name: () => {} } };
        }
        return orig.apply(this, arguments);
      };
      require(${JSON.stringify(SCRIPT)});
      `
    );
    const result = spawnSync(process.execPath, [wrapper], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    assert.notStrictEqual(result.status, 0);
    assert.ok(result.stderr.includes('missing method(s)'));
  });

  test('continues_checking_after_first_require_failure', () => {
    const wrapper = path.join(tmpDir, 'wrapper-continues.js');
    fs.writeFileSync(
      wrapper,
      `
      const Module = require('module');
      const orig = Module.prototype.require;
      Module.prototype.require = function(id) {
        if (id === 'patchright-core/lib/utilsBundle') {
          const err = new Error('module not found');
          err.code = 'MODULE_NOT_FOUND';
          throw err;
        }
        if (id === 'patchright-core/lib/tools/mcp/program') {
          const err = new Error('module not found');
          err.code = 'MODULE_NOT_FOUND';
          throw err;
        }
        return orig.apply(this, arguments);
      };
      require(${JSON.stringify(SCRIPT)});
      `
    );
    const result = spawnSync(process.execPath, [wrapper], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    assert.notStrictEqual(result.status, 0);
    const stderr = result.stderr;
    assert.ok(stderr.includes('require failed'));
    const requireFailures = (stderr.match(/require failed/g) || []).length;
    assert.strictEqual(requireFailures, 2);
  });
});
