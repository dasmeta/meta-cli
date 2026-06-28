# Spec: Driver Wrapper Commands

## Context

`meta-cli` already supports multi-driver `meta init` and persists the selected driver in `metacloud.yaml`. Users still need to remember and manually run driver-specific validate, plan, apply, and destroy commands with the correct bootstrap steps and flags.

## Problem

Runtime workflows are inconsistent across drivers:

- Terraform Cloud uses plain `terraform`
- Terramate requires generated-directory orchestration plus sharing flags
- Terragrunt uses `terragrunt`

Users should not need to memorize the correct command shape, bootstrap steps, or common safety flags for each driver.

## Goals

- Add wrapper commands:
  - `meta validate`
  - `meta plan`
  - `meta apply`
  - `meta destroy`
- Read `metacloud.yaml` and select driver behavior automatically
- Default to the generated driver directory from `metacloud.yaml`
- Allow overriding the target directory
- Add setup filtering via `--setup`
  - repeated flags supported
  - comma-separated values supported
- Allow passing additional raw arguments through to the underlying tool
- Keep `apply` and `destroy` interactive by default
- Detect missing required tooling and print quick install commands for macOS and Linux

## Non-Goals

- Replacing direct use of driver CLIs for advanced workflows
- Reworking `meta exec`
- Adding new secret flows beyond the current Terraform Cloud token path
- Global repo lint cleanup

## User Stories

### 1. Validate without remembering driver details

As an operator, I want `meta validate` to run the correct bootstrap and validation flow for the configured driver so I do not need to remember Terramate or Terragrunt specifics.

### 2. Plan and apply selected setups only

As an operator, I want to target one or more setups with `--setup` so I can operate on a bounded part of the generated tree.

### 3. Safe apply and destroy defaults

As an operator, I want `meta apply` and `meta destroy` to remain manually approved by default so the wrapper does not introduce accidental destructive behavior.

### 4. Missing tool guidance

As an operator, if Terramate or Terragrunt is not installed, I want an immediate clear error and suggested installation commands for my OS.

## Requirements

### Command set

Add:

- `meta validate`
- `meta plan`
- `meta apply`
- `meta destroy`

### Driver selection

- Read `metacloud.yaml`
- If `driver` is missing, treat it as `terraform-cloud`

### Directory selection

- Default to the configured generated directory:
  - Terraform Cloud: `target_dir` or module default
  - Terramate: `target_dir` or `_terraform`
  - Terragrunt: `target_dir` or `_terragrunt`
- Support overriding with a command flag:
  - `--dir <path>`

### Setup filtering

Support:

- repeated form:
  - `--setup group-0/module-a --setup group-2/dns-zone`
- comma-separated form:
  - `--setup group-0/module-a,group-2/dns-zone`

Rules:

- each selector may be:
  - exact relative path
  - exact basename
- ambiguous basename matches must fail with a clear message
- zero matches must fail with a clear message that includes the searched root

### Raw argument passthrough

- Allow appending extra arguments for the underlying tool after `--`
- Also support an internal mapped/default command shape per driver

### Validate behavior

- Try the primary validation command first
- If it fails with an init-required error, perform bootstrap automatically and retry once
- Terraform Cloud validate should run per generated Terraform setup, not a single global validate
- Terramate validate should include the required generate/init behavior

### Lazy init retry

- Apply lazy-init fallback to all four wrapper commands:
  - `validate`
  - `plan`
  - `apply`
  - `destroy`
- Flow:
  - run primary command first
  - if failure matches an init-required error pattern:
    - run driver-appropriate init flow
    - retry the original command once
  - if retry still fails:
    - return the real failure
  - if failure is unrelated to init:
    - do not run init
    - fail immediately

### Apply and destroy safety

- `meta apply` must not add `-auto-approve` automatically
- `meta destroy` must not add `-auto-approve` automatically
- Terramate destroy should use reverse orchestration by default

### Driver command mapping

#### Terraform Cloud

- Validate:
  - identify generated Terraform setup directories
  - run `terraform validate` per setup first
  - if init is required:
    - run `terraform init -backend=false`
    - retry `terraform validate`
- Plan/apply/destroy:
  - run `terraform <command>` in selected setup directories first
  - if init is required:
    - run `terraform init`
    - retry once

#### Terramate

- Validate:
  - `terramate -C <dir> generate`
  - `terramate -C <dir> run --enable-sharing -- terraform validate`
  - if init is required:
    - `terramate -C <dir> run -- terraform init`
    - retry validate once
- Plan/apply:
  - run Terramate with default flags:
    - `--enable-sharing`
    - `--mock-on-fail`
    - `--disable-safeguards=git-untracked,git-uncommitted`
  - if init is required:
    - run `terramate -C <dir> run -- terraform init`
    - retry once
- Destroy:
  - same defaults as plan/apply except:
    - add `--reverse`
    - do not force `--mock-on-fail`
  - if init is required:
    - run `terramate -C <dir> run -- terraform init`
    - retry once

#### Terragrunt

- Validate/plan/apply/destroy:
  - run the corresponding Terragrunt command in the target directory or selected unit directories
  - if init is required:
    - run matching Terragrunt init flow
    - retry once

### Missing tool UX

If the required executable is missing:

- Terraform: suggest `brew install terraform` and Linux install hint
- Terramate: suggest `brew install terramate-io/tap/terramate` and Linux install hint
- Terragrunt: suggest `brew install terragrunt` and Linux install hint

The wrapper must stop before attempting execution.

## CLI shape

Recommended flags:

- `--dir <path>`
- `--setup <selector>` repeatable

Passthrough:

```bash
meta plan -- --parallelism=20
meta apply --setup group-0/module-a -- -lock-timeout=5m
```

## Acceptance Criteria

1. `meta validate` selects the configured driver automatically.
2. Old configs without `driver` still behave as Terraform Cloud.
3. `--setup` supports repeated and comma-separated forms.
4. Ambiguous setup names fail and require path-form selectors.
5. `meta apply` and `meta destroy` do not auto-approve.
6. Terramate wrappers add the expected default flags.
7. Terramate destroy uses reverse orchestration by default.
8. Missing tools produce actionable install guidance for macOS and Linux.
9. README documents the new commands with examples.
