# Driver Wrapper Commands Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `meta validate`, `meta plan`, `meta apply`, and `meta destroy` wrapper commands that map to Terraform Cloud, Terramate, and Terragrunt workflows with safe defaults and setup filtering.

**Architecture:** Introduce a shared driver runtime helper that reads `metacloud.yaml`, resolves driver defaults, selects setup directories, detects required tools, and builds command invocations. Keep command files thin and focused on CLI parsing plus delegation to the shared helper.

**Tech Stack:** TypeScript, oclif, Node child process execution, existing `metacloud.yaml` parsing helpers.

---

## File Structure

- Create: `src/driver-runtime.ts`
  - Shared runtime helper for driver detection, target-dir resolution, setup selection, tool checks, install hints, and command construction.
- Create: `src/commands/validate.ts`
  - Wrapper command for validate behavior.
- Create: `src/commands/plan.ts`
  - Wrapper command for plan behavior.
- Create: `src/commands/apply.ts`
  - Wrapper command for apply behavior.
- Create: `src/commands/destroy.ts`
  - Wrapper command for destroy behavior.
- Modify: `src/utils.ts`
  - Add any config/default helpers needed by runtime selection.
- Modify: `README.md`
  - Document wrapper commands, `--setup`, `--dir`, passthrough args, and missing tool behavior.
- Test: `test/driver-runtime.test.ts`
  - Behavior tests for setup parsing, directory selection, tool detection helpers, and driver command construction.

## Chunk 1: Shared runtime helper and tests

- [ ] Write failing tests for:
  - `--setup` normalization from repeated and comma-separated input
  - ambiguous basename detection
  - zero-match behavior
  - driver target-directory defaults
  - Terramate command defaults for validate/plan/apply/destroy
  - non-auto-approve behavior for apply/destroy
- [ ] Run the focused test file and confirm failure.
- [ ] Implement `src/driver-runtime.ts` with:
  - setup parsing
  - setup directory matching
  - driver target-dir resolution
  - tool lookup and install hint helper
  - command-spec builder per driver/action
  - lazy init retry detection and retry plan generation
- [ ] Re-run the focused tests until green.

## Chunk 2: Wrapper commands

- [ ] Create `src/commands/validate.ts`
- [ ] Create `src/commands/plan.ts`
- [ ] Create `src/commands/apply.ts`
- [ ] Create `src/commands/destroy.ts`
- [ ] Add shared flags:
  - `--dir`
  - `--setup` (multiple)
- [ ] Support raw passthrough args after `--`
- [ ] Delegate execution to the shared runtime helper
- [ ] Ensure validate runs bootstrap steps when required
- [ ] Ensure Terramate destroy uses reverse mode by default
- [ ] Ensure apply/destroy stay interactive by default

## Chunk 3: Documentation

- [ ] Update `README.md` with:
  - wrapper command purpose
  - driver-specific default behavior
  - `--setup` examples
  - `--dir` examples
  - passthrough examples
  - missing tool guidance examples

## Chunk 4: Verification

- [ ] Run focused tests:
  - `./node_modules/.bin/mocha --forbid-only "test/driver-runtime.test.ts"`
- [ ] Run the full test suite:
  - `./node_modules/.bin/mocha --forbid-only "test/**/*.test.ts"`
- [ ] Run TypeScript build:
  - `./node_modules/.bin/tsc -b`
- [ ] Note any unrelated repo-wide lint debt but do not expand scope into global lint cleanup.
