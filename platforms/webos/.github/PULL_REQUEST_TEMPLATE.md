# Pull Request

## 📋 Description

<!-- What changed? Why? -->

## ✅ Acceptance Criteria

<!-- What must be true for this PR to be considered complete? -->

- [ ] All acceptance criteria from the linked issue/task are met
- [ ] Changes match the intent described in the task description
- [ ] No visual regressions (screenshots attached for UI changes)

## 🧪 Testing

<!-- What did you test? How did you verify it works? -->

- [ ] Unit tests pass (`npm test` / `vitest run`)
- [ ] E2E tests pass (`npm run e2e`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build passes (`npm run build`)
- [ ] Contract tests pass with @ctv/core
- [ ] Tested in browser emulator (describe below)
- [ ] **Manual test on physical WebOS TV scheduled by developer** (REQUIRED)

**Device/Environment tested:**
<!-- e.g. "Chromium playwright test", "LG WebOS 23 emulator", "Simulator — manual TV test TBD by developer" -->

## 📸 Screenshots (UI Changes Only)

<!-- Attach before/after screenshots for any UI changes -->

| Before | After |
| ------ | ----- |
|        |       |

## 🔗 Related

- Closes/Resolves: #
- Task/Issue: #
- Depends on: # (if applicable)

## ⚠️ Breaking Changes

- [ ] This PR contains breaking changes
- [ ] No breaking changes

<!-- If breaking changes: explain migration path, affected consumers -->

## 🤖 AI-Assisted Changes

<!-- If AI was used to write/modify code, answer below -->

- [ ] AI was used to generate or modify code in this PR
- [ ] Code was reviewed and verified by a human
- [ ] AI's work matches the task description

## 📊 Contract Impact

<!-- Did this PR change any interfaces that FireTV or other platform apps consume? -->

- [ ] No contract changes
- [ ] Contract changes — @ctv/core consumers need updates
- [ ] New contract endpoints added

---

> **NOTE:** WebOS requires **manual testing on a physical TV** before merging. This is a human-only step — the developer must physically interact with the TV. AI-generated PRs must include documentation of the manual TV test results.
