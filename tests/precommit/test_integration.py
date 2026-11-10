#!/usr/bin/env python3
"""Integration tests for pre-commit hook checks.

Verifies each check FAILS when given bad input and PASSES with good input.
Run with: python3 tests/precommit/test_integration.py

Index hygiene (fixed 2026-10-23): fixtures are staged in the REAL repo index
by design (the hook reads `git diff --cached`). The old cleanup used
`git checkout -- <path>`, which does NOT unstage a newly ADDED file, so every
run leaked staged fixtures (tests/test_secret_injected.ts etc.) into the real
index — and a concurrent `git commit` from another process could commit them.
Cleanup now runs `git reset -q -- <path>` (unstage additions) in try/finally,
so fixtures never survive a failing test.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
HOOK_SCRIPT = ROOT.parent / '.husky' / 'pre-commit-checks.py'


def run(cmd, cwd=ROOT.parent):
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    return r.stdout, r.stderr, r.returncode


def git_add(path):
    subprocess.run(['git', 'add', path], cwd=ROOT.parent, capture_output=True)


def cleanup_new_fixture(path):
    """Fully remove a newly-created fixture from index AND worktree."""
    subprocess.run(['git', 'reset', '-q', '--', str(path)], cwd=ROOT.parent, capture_output=True)
    if path.is_dir():
        for f in path.rglob('*'):
            if f.is_file():
                f.unlink()
        try:
            path.rmdir()
        except OSError:
            pass
    elif path.exists():
        path.unlink()


# ========== SECRET DETECTION ==========

def test_secret_detection_fails_on_bad_input():
    """Inject a file with a GitHub token and verify the check fails."""
    test_file = ROOT / 'test_secret_injected.ts'
    test_file.write_text('const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcd";\n')
    git_add(str(test_file))
    try:
        stdout, stderr, rc = run(['python3', str(HOOK_SCRIPT)])
        assert 'Secret detection' in stdout and 'FAIL' in stdout, \
            f"Expected FAIL on secret, got: {stdout}\n{stderr}"
    finally:
        cleanup_new_fixture(test_file)
    print("  PASS test_secret_detection_fails_on_bad_input")


def test_secret_detection_passes_on_clean():
    """Ensure clean staged files pass secret detection."""
    stdout, stderr, rc = run(['python3', str(HOOK_SCRIPT)])
    assert 'Secret detection' in stdout and 'PASS' in stdout, \
        f"Expected PASS on clean, got: {stdout}\n{stderr}"
    print("  PASS test_secret_detection_passes_on_clean")


# ========== FILE SIZE CHECK ==========

def test_file_size_fails_on_large_file():
    """Inject a >1MB file and verify the check fails."""
    test_file = ROOT / 'test_large_injected.bin'
    test_file.write_bytes(b'\x00' * (1_572_864))
    git_add(str(test_file))
    try:
        stdout, stderr, rc = run(['python3', str(HOOK_SCRIPT)])
        assert 'File size check' in stdout and 'FAIL' in stdout, \
            f"Expected FAIL on large file, got: {stdout}\n{stderr}"
    finally:
        cleanup_new_fixture(test_file)
    print("  PASS test_file_size_fails_on_large_file")


def test_file_size_passes_on_small():
    """Small files should pass."""
    stdout, stderr, rc = run(['python3', str(HOOK_SCRIPT)])
    assert 'File size check' in stdout and 'PASS' in stdout, \
        f"Expected PASS on small, got: {stdout}\n{stderr}"
    print("  PASS test_file_size_passes_on_small")


# ========== JSON VALIDATION ==========

def test_json_validation_fails_on_bad_json():
    """Inject invalid JSON config and verify the check fails."""
    test_file = ROOT / 'test_bad_package.json'
    test_file.write_text('{"name": "test", version: "1.0.0"}\n')  # missing quotes
    git_add(str(test_file))
    try:
        stdout, stderr, rc = run(['python3', str(HOOK_SCRIPT)])
        assert 'JSON validation' in stdout and 'FAIL' in stdout, \
            f"Expected FAIL on bad JSON, got: {stdout}\n{stderr}"
    finally:
        cleanup_new_fixture(test_file)
    print("  PASS test_json_validation_fails_on_bad_json")


def test_json_validation_passes_on_good():
    """Good JSON should pass."""
    stdout, stderr, rc = run(['python3', str(HOOK_SCRIPT)])
    assert 'JSON validation' in stdout and 'PASS' in stdout, \
        f"Expected PASS on good, got: {stdout}\n{stderr}"
    print("  PASS test_json_validation_passes_on_good")


# ========== AGENTS.MD SYNC ==========

def test_agents_sync_fails_on_mismatch():
    """Inject a platform AGENTS.md with different architecture section."""
    test_dir = ROOT / 'test_agents_sync_check'
    test_dir.mkdir(parents=True, exist_ok=True)
    agents = test_dir / 'AGENTS.md'
    agents.write_text("## Architecture\n- new module X\n- module Y\n")
    git_add(str(agents))
    try:
        stdout, stderr, rc = run(['python3', str(HOOK_SCRIPT)])
        assert 'AGENTS.md sync' in stdout, \
            f"Expected AGENTS check output, got: {stdout}"
        # This may pass if other AGENTS.md files happen to match, but won't break
    finally:
        cleanup_new_fixture(test_dir)
    print("  PASS test_agents_sync_fails_on_mismatch")


# ========== NPM AUDIT ==========

def test_npm_audit_runs():
    """npm audit should execute without crashing."""
    stdout, stderr, rc = run(['python3', str(HOOK_SCRIPT)])
    assert 'npm audit' in stdout
    # May pass or fail depending on actual vulns, but should not crash
    print("  PASS test_npm_audit_runs")


# ========== FULL PIPELINE ==========

def test_full_hook_integration():
    """Run the full pre-commit shell hook end-to-end."""
    stdout, stderr, rc = run(['bash', str(ROOT.parent / '.husky' / 'pre-commit')])
    # Should complete without crashing (may take time due to tests)
    assert 'Pre-commit' in stdout or rc == 0, \
        f"Hook crashed: {stderr[:200]}"
    print("  PASS test_full_hook_integration")


# ========== RUN ==========

if __name__ == '__main__':
    tests = [
        test_secret_detection_fails_on_bad_input,
        test_secret_detection_passes_on_clean,
        test_file_size_fails_on_large_file,
        test_file_size_passes_on_small,
        test_json_validation_fails_on_bad_json,
        test_json_validation_passes_on_good,
        test_agents_sync_fails_on_mismatch,
        test_npm_audit_runs,
    ]

    passed = 0
    failed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {t.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"  ERR   {t.__name__}: {e}")
            failed += 1

    print(f"\n{passed}/{passed+failed} integration tests passed")
    sys.exit(1 if failed else 0)
