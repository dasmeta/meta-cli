# Multi-Driver `meta init` Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add driver-aware `meta init` support so `meta-cli` can generate Terraform Cloud, Terramate, or Terragrunt `_metacloud.tf` from `metacloud.yaml` while preserving backward compatibility for existing Terraform Cloud users.

**Architecture:** Keep `metacloud.yaml` as the single config source and split `_metacloud.tf` generation by driver in `src/utils.ts`. Extend the CLI entrypoint in `src/commands/init.ts` to accept an optional `--driver` flag on first run, default missing drivers to `terraform-cloud`, and reuse existing Terraform Cloud token behavior plus existing AWS session behavior from `meta exec` for Terramate and Terragrunt.

**Tech Stack:** TypeScript, oclif CLI commands, YAML parsing via `yaml`, Mocha/@oclif test tooling, README generation via `oclif readme`

---

## File Structure

### Existing files to modify

- `src/utils.ts`
  - Extend config types
  - Read/write `driver`
  - Add shared `terraform_backend` and optional Terramate/Terragrunt config fields
  - Split `_metacloud.tf` generation into per-driver functions plus a dispatcher
- `src/commands/init.ts`
  - Add `--driver`
  - Preserve existing backward-compatible first-run and rerun behavior
  - Gate Terraform Cloud-specific prompts and 1Password token assumptions by driver
- `README.md`
  - Document driver selection
  - Document backward compatibility
  - Add config examples for all three drivers
  - Add backend configuration examples for Terramate/Terragrunt
- `package.json`
  - No functional change expected, but note scripts and readme generation behavior in testing steps

### Existing tests to extend or create

- `test/commands/auth.test.ts`
  - no expected changes
- `test/commands/configure.test.ts`
  - no expected changes
- `test/commands/exec.test.ts`
  - no expected changes
- `test/commands/open.test.ts`
  - no expected changes
- `test/commands/init.test.ts`
  - Create this file
  - Add focused tests for first-run and rerun driver behavior
- `test/utils.test.ts`
  - Create this file
  - Add focused tests for config parsing and per-driver `_metacloud.tf` generation

### Spec artifacts in scope

- `specs/001-multi-driver-init/spec.md`
- `specs/001-multi-driver-init/plan.md`
- `specs/001-multi-driver-init/tasks.md`
  - Create after plan approval if following the full Speckit sequence

## Implementation Strategy

- Keep the change narrowly scoped to `meta init` and config/generation helpers
- Preserve legacy Terraform Cloud behavior as the default path
- Do not introduce new 1Password secret requirements for Terramate/Terragrunt
- Keep one shared `terraform_backend` block in `metacloud.yaml` for Terramate/Terragrunt v1
- Prefer explicit per-driver generator functions over one monolithic string builder

## Chunk 1: Config Model And Generation Functions

### Task 1: Extend config typing for multi-driver support

**Files:**
- Modify: `src/utils.ts`
- Test: `test/utils.test.ts`

- [ ] **Step 1: Write the failing config-shape test**

Create `test/utils.test.ts` with a test that expects config parsing and writing helpers to support:
- `driver`
- optional `terraform_backend`
- optional Terramate/Terragrunt-specific fields

Example test shape:

```ts
describe('metacloud config helpers', () => {
  it('parses a config with driver and backend fields', () => {
    // arrange
    // act
    // assert
  })
})
```

- [ ] **Step 2: Run the targeted test and verify failure**

Run:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
yarn test -- test/utils.test.ts
```

Expected:
- failure because the test file or new parsing expectations do not exist yet

- [ ] **Step 3: Extend `MetaConfig` and supporting types**

Modify `src/utils.ts`:

- add a driver type such as:
  - `terraform-cloud`
  - `terramate`
  - `terragrunt`
- extend `MetaConfig` with:
  - `driver?`
  - `terraformBackend?`
  - `linkingMode?`
  - `mockInputsEnabled?`
  - `stackIdPrefix?`

Also decide on YAML key naming and keep it consistent between read and write helpers:
- `driver`
- `terraform_backend`
- `linking_mode`
- `mock_inputs_enabled`
- `stack_id_prefix`

- [ ] **Step 4: Update `generateMetaCloudConfig` to emit the new schema**

Modify `src/utils.ts` so config generation:
- writes `driver`
- writes `terraform_backend` for Terramate/Terragrunt when supplied
- keeps current Terraform Cloud keys unchanged
- avoids writing empty optional keys unless they are needed

- [ ] **Step 5: Update `getMetaCloudConfig` to parse new fields**

Modify `src/utils.ts` so config parsing:
- reads `driver`
- defaults missing `driver` to `terraform-cloud`
- reads `terraform_backend`
- reads Terramate/Terragrunt-specific optional fields

- [ ] **Step 6: Run the targeted test and verify pass**

Run:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
yarn test -- test/utils.test.ts
```

Expected:
- the config parsing/writing test passes

- [ ] **Step 7: Commit**

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
git add src/utils.ts test/utils.test.ts
git commit -m "test: add multi-driver metacloud config parsing"
```

### Task 2: Split `_metacloud.tf` generation by driver

**Files:**
- Modify: `src/utils.ts`
- Test: `test/utils.test.ts`

- [ ] **Step 1: Write failing tests for per-driver module generation**

Add tests that assert `_metacloud.tf` generation:
- uses `dasmeta/cloud/tfe` for Terraform Cloud
- uses `dasmeta/cli/terramate` for Terramate
- uses `dasmeta/cli/terragrunt` for Terragrunt
- includes Terramate/Terragrunt backend config wiring
- falls back to Terraform Cloud when `driver` is omitted

- [ ] **Step 2: Run the targeted tests and verify failure**

Run:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
yarn test -- test/utils.test.ts
```

Expected:
- generation tests fail because driver-specific generation does not exist yet

- [ ] **Step 3: Introduce per-driver generator functions**

Modify `src/utils.ts` to create:
- `generateTerraformCloudTF(config)`
- `generateTerramateTF(config)`
- `generateTerragruntTF(config)`
- `generateMetaCloudTF(config)` dispatcher

Implementation rules:
- Terraform Cloud keeps existing module source and token-oriented variables
- Terramate uses `dasmeta/cli/terramate`
- Terragrunt uses `dasmeta/cli/terragrunt`
- Terramate/Terragrunt generation should pass:
  - `yamldir`
  - `targetdir`
  - `terraform_backend`
- Terramate should also pass optional:
  - `linking_mode`
  - `mock_inputs_enabled`
  - `stack_id_prefix`

- [ ] **Step 4: Keep string generation minimal and explicit**

While editing:
- do not add config keys not covered by the spec
- do not add per-stack backend logic
- do not add new secret plumbing for Terramate/Terragrunt

- [ ] **Step 5: Run the targeted tests and verify pass**

Run:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
yarn test -- test/utils.test.ts
```

Expected:
- the generation tests pass for all three driver branches

- [ ] **Step 6: Commit**

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
git add src/utils.ts test/utils.test.ts
git commit -m "feat: add driver-specific _metacloud tf generation"
```

## Chunk 2: `meta init` Driver Selection Behavior

### Task 3: Add `--driver` to `meta init`

**Files:**
- Modify: `src/commands/init.ts`
- Test: `test/commands/init.test.ts`

- [ ] **Step 1: Write the failing CLI flag tests**

Create `test/commands/init.test.ts` with cases covering:
- first run without `--driver` defaults to Terraform Cloud
- first run with `--driver terramate`
- first run with `--driver terragrunt`
- rerun with existing `metacloud.yaml` uses stored driver even when flag is omitted

Use the repo’s oclif test conventions if present.

- [ ] **Step 2: Run the targeted test and verify failure**

Run:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
yarn test -- test/commands/init.test.ts
```

Expected:
- failure because `init` does not yet support the new flag and behavior

- [ ] **Step 3: Add the `--driver` flag**

Modify `src/commands/init.ts`:
- add optional `--driver`
- allowed values:
  - `terraform-cloud`
  - `terramate`
  - `terragrunt`
- keep `terraform-cloud` as the default when first-run flag is absent

- [ ] **Step 4: Keep existing file-reuse behavior**

Modify the existing control flow so:
- if `metacloud.yaml` exists and `--force` is not used:
  - read `driver` from file
  - if absent, default to `terraform-cloud`
- if first run or `--force`:
  - use `--driver` if provided
  - otherwise default to `terraform-cloud`

- [ ] **Step 5: Gate prompts and token expectations by driver**

Ensure:
- Terraform Cloud-specific assumptions stay on the Terraform Cloud path
- Terramate/Terragrunt paths do not force new Terraform Cloud-specific config collection beyond what is needed for git/common config

Be careful not to break existing interactive Terraform Cloud behavior.

- [ ] **Step 6: Run the targeted tests and verify pass**

Run:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
yarn test -- test/commands/init.test.ts
```

Expected:
- all new init driver behavior tests pass

- [ ] **Step 7: Commit**

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
git add src/commands/init.ts test/commands/init.test.ts
git commit -m "feat: add driver selection to meta init"
```

### Task 4: Preserve backward compatibility for old configs

**Files:**
- Modify: `src/utils.ts`
- Modify: `src/commands/init.ts`
- Test: `test/utils.test.ts`
- Test: `test/commands/init.test.ts`

- [ ] **Step 1: Write the failing compatibility tests**

Add tests for:
- config without `driver`
- rerun `meta init` using that config
- generated `_metacloud.tf` still uses `dasmeta/cloud/tfe`

- [ ] **Step 2: Run the targeted tests and verify failure**

Run:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
yarn test -- test/utils.test.ts test/commands/init.test.ts
```

Expected:
- compatibility tests fail before the fallback is fully wired

- [ ] **Step 3: Implement the explicit fallback**

Ensure both parsing and init flow use:
- missing `driver` => `terraform-cloud`

Do not rely on incidental undefined behavior.

- [ ] **Step 4: Run the targeted tests and verify pass**

Run:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
yarn test -- test/utils.test.ts test/commands/init.test.ts
```

Expected:
- compatibility tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
git add src/utils.ts src/commands/init.ts test/utils.test.ts test/commands/init.test.ts
git commit -m "fix: preserve terraform-cloud default init behavior"
```

## Chunk 3: Documentation And Final Validation

### Task 5: Update README with driver and backend examples

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add command usage documentation**

Document:
- `meta init`
- `meta init --driver terramate`
- `meta init --driver terragrunt`
- first-run vs rerun behavior

- [ ] **Step 2: Add config examples**

Add example `metacloud.yaml` sections for:
- Terraform Cloud
- Terramate
- Terragrunt

Include a shared backend example for Terramate/Terragrunt, preferably S3.

- [ ] **Step 3: Add compatibility notes**

Document:
- missing `driver` means `terraform-cloud`
- existing users do not need to change old `metacloud.yaml`

- [ ] **Step 4: Add AWS environment notes**

Explain:
- Terraform Cloud still uses existing token flow
- Terramate/Terragrunt reuse existing AWS session/env behavior from `meta exec`

- [ ] **Step 5: Regenerate command docs if needed**

Run:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
yarn version --no-git-tag-version --new-version "$(node -p "require('./package.json').version")"
```

If the repo’s version script is too invasive, prefer the minimal README refresh command already used by the repo:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
npx oclif readme
```

Expected:
- README command section reflects the updated `init` flags

- [ ] **Step 6: Commit**

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
git add README.md package.json
git commit -m "docs: add multi-driver meta init usage"
```

### Task 6: Run full validation

**Files:**
- No code changes expected unless validation finds issues

- [ ] **Step 1: Run unit and command tests**

Run:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
yarn test
```

Expected:
- all tests pass

- [ ] **Step 2: Run lint**

Run:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
yarn lint
```

Expected:
- no lint errors

- [ ] **Step 3: Run build**

Run:

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
yarn build
```

Expected:
- TypeScript build succeeds

- [ ] **Step 4: Manually smoke-check generated output paths**

Use temporary fixtures or focused helper tests to verify:
- no-driver config => Terraform Cloud output
- Terramate config => Terramate module source and backend wiring
- Terragrunt config => Terragrunt module source and backend wiring

- [ ] **Step 5: Final commit if validation forced follow-up edits**

```bash
cd /Users/tmuradyan/projects/dasmeta/meta-cli
git add -A
git commit -m "test: validate multi-driver meta init flow"
```

## Notes For Execution

- Prefer adding focused tests around pure helpers in `src/utils.ts` before touching CLI flow
- Keep `meta init` behavior changes small and explicit
- Do not mix unrelated cleanup into this feature
- Do not introduce per-stack backend config in `meta-cli`
- Do not add Terramate/Terragrunt secret-fetching flows in this feature

## Review Constraint

This environment supports agent spawning only when the user explicitly asks for sub-agents. Since that permission was not granted here, the plan-document subagent review loop from the generic `writing-plans` skill should be skipped for this repo plan.

Plan complete and saved to `specs/001-multi-driver-init/plan.md`. Ready to execute?
