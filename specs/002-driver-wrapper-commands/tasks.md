# Tasks: Driver Wrapper Commands

## 1. Shared runtime helper

- [x] Add shared driver runtime/types helper for validate, plan, apply, and destroy.
- [x] Add setup selector parsing and matching logic.
- [x] Add tool detection and install hint generation.
- [x] Add per-driver command-spec generation.
- [x] Add lazy-init detection and one-time retry behavior.

## 2. Tests first

- [x] Add failing tests for setup normalization.
- [x] Add failing tests for ambiguous and missing setup matching.
- [x] Add failing tests for driver default command construction.
- [x] Add failing tests proving apply/destroy do not auto-approve by default.

## 3. Wrapper commands

- [x] Add `meta validate`.
- [x] Add `meta plan`.
- [x] Add `meta apply`.
- [x] Add `meta destroy`.
- [x] Add `--dir` support.
- [x] Add repeated and comma-separated `--setup` support.
- [x] Add raw passthrough arg support.

## 4. Documentation

- [x] Document the new wrapper commands in `README.md`.
- [x] Add examples for Terraform Cloud, Terramate, and Terragrunt flows.
- [x] Document missing-tool install hints and `--setup` usage.

## 5. Verification

- [x] Run focused wrapper helper tests.
- [x] Run the full test suite.
- [x] Run TypeScript build.
- [x] Keep unrelated global lint debt out of scope.
