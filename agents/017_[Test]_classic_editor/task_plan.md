# Classic editor integration verification

## Goal
Verify the restored left-form/right-preview editor and user-visible Canvas export behavior without changing product code.

## Plan
- [x] Fast-forward this task worktree to main integration base `09a4d7f`.
- [x] Read current profile browser integration coverage and identify assertions tied to the old overlay/hit-area design.
- [x] Update profile integration assertions for flexible barcode sizing, form-driven choices, QR slot drag/drop, preserved faction/operator/QR behavior, and attribution toggle.
- [x] Add focused editor layout and attribution browser checks.
- [x] Wait for parent integration, then run the full suite and fix the font fixture.
- [ ] Commit the verified follow-up test changes locally; report commit SHA.

## Scope
Only root `test/profile-integration.browser.test.cjs`, a new browser test under `test/`, and this audit folder. No product files.
