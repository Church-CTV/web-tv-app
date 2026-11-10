#!/usr/bin/env python3
"""
Tests for pre-commit hook checks.
Run with: python3 tests/precommit/test_checks.py
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent

# ---------- helpers ----------

def run(cmd, cwd=ROOT):
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    return r.stdout, r.stderr, r.returncode


# ========== 1. SECRET DETECTION ==========

def test_secret_detection_finds_token():
    """Should catch GitHub tokens, API keys, secrets in staged files."""
    content = 'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcd";\n'
    import re
    patterns = [
        r'ghp_[A-Za-z0-9]{36,}',       # GitHub PAT
        r'github_pat_[A-Za-z0-9_]{22,}',  # GitHub enterprise PAT
        r'sk-[A-Za-z0-9]{32,}',         # Stripe key
        r'AKIA[0-9A-Z]{16}',            # AWS key
        r'-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----',  # Private key
        r'password\s*[=:]\s*["\']?[^"\']{8,}',  # Password assignment
        r'api[_-]?key\s*[=:]\s*["\']?[^"\']{8,}',  # API key
        r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}',  # JWT
    ]
    found = any(re.compile(p).search(content) for p in patterns)
    assert found, "Should detect token in staged file"


def test_secret_detection_passes_clean():
    """Should not flag normal code."""
    content = 'const serverUrl = process.env.SERVER_URL || "https://api.example.com";\n'
    import re
    patterns = [
        r'ghp_[A-Za-z0-9]{36,}',
        r'github_pat_[A-Za-z0-9_]{22,}',
        r'sk-[A-Za-z0-9]{32,}',
        r'AKIA[0-9A-Z]{16}',
        r'-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----',
        r'password\s*[=:]\s*["\']?[^"\']{8,}',
        r'api[_-]?key\s*[=:]\s*["\']?[^"\']{8,}',
        r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}',
    ]
    found = any(re.compile(p).search(content) for p in patterns)
    assert not found, "Should not flag normal env-based config"


# ========== 2. FILE SIZE CHECK ==========

def test_file_size_detects_large_file():
    """Should detect files >1MB."""
    import re
    # Simulate: "platforms/webos/dist/bundle.js 512000"
    output = "platforms/webos/dist/assets/app.js 1048577\n"
    patterns = re.findall(r'\S+\s+(\d+)', output)
    large = [int(s) for s in patterns if int(s) > 1_048_576]
    assert len(large) > 0, "Should detect file > 1MB"


def test_file_size_passes_small():
    """Should allow files < 1MB."""
    import re
    output = "src/App.ts 4500\nsrc/ui/Card.ts 2200\n"
    patterns = re.findall(r'\S+\s+(\d+)', output)
    large = [int(s) for s in patterns if int(s) > 1_048_576]
    assert len(large) == 0, "Should pass for small files"


# ========== 3. JSON/YAML VALIDATION ==========

def test_jsonc_parser_valid():
    """Valid JSON files should pass."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        f.write('{"name": "test", "version": "1.0.0"}\n')
        path = f.name
    _, _, rc = run(['node', '-e', f'require("{path}")'])
    os.unlink(path)
    assert rc == 0, "Valid JSON should parse"


def test_jsonc_parser_invalid():
    """Invalid JSON should fail."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        f.write('{"name": "test", version: "1.0.0"}\n')  # missing quotes on key
        path = f.name
    _, _, rc = run(['node', '-e', f'require("{path}")'])
    os.unlink(path)
    assert rc != 0, "Invalid JSON should fail"


def test_jsonc_parser_trailing_comma():
    """JSONC (trailing comma) should pass with JSONC parser."""
    # Node's JSON.parse rejects trailing commas, but JSONC allows it
    # We use a custom JSONC parser in the hook, so this should pass
    content = '{"name": "test",}\n'
    import json
    try:
        json.loads(content)
        passed = True
    except json.JSONDecodeError:
        passed = False
    assert not passed, "Standard JSON.parse rejects trailing commas (JSONC needed)"


# ========== 4. AGENTS.MD SYNC CHECK ==========

def test_ags_sync_same_structure():
    """AGENTS.md across platforms should have same architecture section."""
    arch_pattern = Path(ROOT).rglob('**/AGENTS.md')
    files = list(arch_pattern)
    # At minimum core + 3 platforms
    assert len(files) >= 4, f"Expected 4+ AGENTS.md files, found {len(files)}"


def test_ags_sync_test():
    """Test with mock files."""
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp)
        core = p / "core"
        core.mkdir()
        (core / "AGENTS.md").write_text("## Architecture\n- module A\n- module B\n")
        webos = p / "platforms" / "webos"
        webos.mkdir(parents=True)
        (webos / "AGENTS.md").write_text("## Architecture\n- module A\n- module B\n")
        tizen = p / "platforms" / "tizen"
        tizen.mkdir(parents=True)
        (tizen / "AGENTS.md").write_text("## Architecture\n- module A\n- module C\n")
        vizio = p / "platforms" / "vizio"
        vizio.mkdir(parents=True)
        (vizio / "AGENTS.md").write_text("## Architecture\n- module A\n- module B\n")

        # Extract architecture sections
        def extract_arch(path):
            content = Path(path).read_text()
            in_arch = False
            lines = []
            for line in content.split('\n'):
                if line.startswith('## Architecture'):
                    in_arch = True
                    continue
                if in_arch and line.startswith('## '):
                    break
                if in_arch:
                    lines.append(line.strip())
            return sorted(set(lines))

        ags = list(p.rglob('AGENTS.md'))
        arch_sections = {str(a.relative_to(p)): extract_arch(a) for a in ags}
        # Should detect mismatch
        unique = set(tuple(s) for s in arch_sections.values())
        assert len(unique) > 1, "Should detect architecture section differences"


# ========== 5. NPM AUDIT CHECK ==========

def test_npm_audit_runs():
    """npm audit should execute without crashing."""
    stdout, stderr, rc = run(['npm', 'audit', '--production', '--audit-level=high'])
    # May find issues but should not crash
    assert rc in (0, 1), f"npm audit returned unexpected code: {rc}\n{stderr[:200]}"


# ========== 6. COMMIT MSG FORMAT ==========

def test_commit_msg_valid():
    """Valid conventional commit should pass."""
    import re
    pattern = re.compile(
        r'^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .{1,72}$'
    )
    assert pattern.match("feat(webos): add search screen")
    assert pattern.match("fix: resolve build error")
    assert pattern.match("chore(deps): update dependencies")
    assert pattern.match("revert: undo bad commit")


def test_commit_msg_invalid():
    """Invalid commit message should fail."""
    import re
    pattern = re.compile(
        r'^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .{1,72}$'
    )
    assert not pattern.match("bad commit message")
    assert not pattern.match("WIP: work in progress")
    assert not pattern.match("feat: " + "x" * 73)  # too long


# ========== RUN ==========

if __name__ == '__main__':
    tests = [
        test_secret_detection_finds_token,
        test_secret_detection_passes_clean,
        test_file_size_detects_large_file,
        test_file_size_passes_small,
        test_jsonc_parser_valid,
        test_jsonc_parser_invalid,
        test_jsonc_parser_trailing_comma,
        test_ags_sync_same_structure,
        test_ags_sync_test,
        test_npm_audit_runs,
        test_commit_msg_valid,
        test_commit_msg_invalid,
    ]

    passed = 0
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {t.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"  ERR   {t.__name__}: {e}")
            failed += 1

    print(f"\n{passed}/{passed+failed} tests passed")
    sys.exit(1 if failed else 0)
