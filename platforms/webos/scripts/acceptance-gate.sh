#!/bin/bash
# Acceptance test gate for WebOS — verifies AI-generated code meets task criteria
# Usage: ./scripts/acceptance-gate.sh "<task description>"

TASK="${1:-manual-check}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "═══════════════════════════════════════════════"
echo "  ACCEPTANCE TEST GATE — WebOS"
echo "  Task: $TASK"
echo "  Time: $(date -Iseconds)"
echo "═══════════════════════════════════════════════"

PASS=0
FAIL=0

# 1: Build
echo -e "\n\033[0;36mPhase 1: Build Verification\033[0m"
npm run build 2>&1 | tail -3
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "  \033[0;32m✓\033[0m Build passed"
    ((PASS++))
else
    echo -e "  \033[0;31m✗\033[0m Build FAILED"
    ((FAIL++))
fi

# 2: Tests
echo -e "\n\033[0;36mPhase 2: Test Verification\033[0m"
npm test 2>&1 | tail -3
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "  \033[0;32m✓\033[0m Tests passed"
    ((PASS++))
else
    echo -e "  \033[0;31m✗\033[0m Tests FAILED"
    ((FAIL++))
fi

# 3: Commit type check
echo -e "\n\033[0;36mPhase 3: Commit Verification\033[0m"
COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null || echo "")
if echo "$COMMIT_MSG" | grep -qE "^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\([^)]+\))?: .+"; then
    echo -e "  \033[0;32m✓\033[0m Commit message follows Conventional Commits"
    ((PASS++))
else
    echo -e "  \033[0;31m✗\033[0m Commit message does NOT follow Conventional Commits"
    ((FAIL++))
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  Results: \033[0;32m$PASS passed\033[0m  \033[0;31m$FAIL failed\033[0m"
echo "═══════════════════════════════════════════════"

[ $FAIL -gt 0 ] && exit 1
exit 0
