# Spec: Multi-Driver `meta init` Support

## Context

`meta-cli` currently supports a single driver-oriented initialization flow:

- `meta init` generates `metacloud.yaml`
- `meta init` generates `_metacloud.tf`
- `_metacloud.tf` always uses the Terraform Cloud driver module:
  - `dasmeta/cloud/tfe`

The repo has not used Speckit before. This first spec must therefore also serve
as the initial Speckit baseline for future `meta-cli` work:

- specs live under `specs/`
- feature work should describe current behavior, target behavior, validation,
  and documentation expectations
- backward compatibility for existing users must be explicit, not implied

## Problem

`meta-cli` is currently Terraform Cloud-driver specific, while the ecosystem now
also has:

- `dasmeta/cli/terramate`
- `dasmeta/cli/terragrunt`

Users should be able to initialize infrastructure repositories through the same
`meta init` workflow while choosing which driver module is generated into
`_metacloud.tf`.

For Terramate and Terragrunt, Terraform backend configuration is one of the most
important settings, because it controls both:

- how the driver module run is configured
- how generated stacks/units are configured to store their state

The current `meta-cli` UX does not expose a driver selection model or a shared
backend configuration model for these drivers.

## Goals

1. Support `meta init --driver <driver>` on first run.
2. Persist the selected driver in `metacloud.yaml`.
3. Allow later `meta init` runs to use the driver from `metacloud.yaml`
   without requiring `--driver`.
4. Keep `terraform-cloud` as the default driver for both:
   - first run when no driver is specified
   - existing old `metacloud.yaml` files that do not contain a `driver` key
5. Support Terramate and Terragrunt generation through `_metacloud.tf`.
6. Support one easy shared `terraform_backend` configuration block in
   `metacloud.yaml` for Terramate and Terragrunt.
7. Reuse existing `meta exec` AWS credential/session behavior for Terramate and
   Terragrunt.
8. Document the new behavior clearly in the repo README with examples.

## Non-Goals

1. Per-stack or per-unit backend customization in `meta-cli`.
   That remains a downstream YAML-driver concern.
2. New 1Password secret requirements for Terramate or Terragrunt v1 support.
3. Changing existing Terraform Cloud token behavior beyond making it conditional
   on the selected driver.
4. Reworking `meta exec` provider logic beyond reusing its current AWS session
   environment output.

## User Stories

### Existing Terraform Cloud user

As a current `meta-cli` user with an old `metacloud.yaml`, I want `meta init`
to keep working exactly as before so I am not forced to migrate or set a driver
explicitly.

### New Terramate user

As a new user, I want to run `meta init --driver terramate`, get a Terramate
driver configuration written into `metacloud.yaml`, and get a generated
`_metacloud.tf` that uses `dasmeta/cli/terramate`.

### New Terragrunt user

As a new user, I want to run `meta init --driver terragrunt`, get a Terragrunt
driver configuration written into `metacloud.yaml`, and get a generated
`_metacloud.tf` that uses `dasmeta/cli/terragrunt`.

### Re-run after first setup

As a user with an existing `metacloud.yaml`, I want later `meta init` runs to
reuse the stored driver and driver config so I do not need to keep passing
`--driver`.

## Target Configuration Model

### Common behavior

`metacloud.yaml` becomes the single source of truth for:

- selected driver
- git settings
- output directories
- YAML directory
- handler version
- backend configuration when relevant

### Backward compatibility rule

If `driver` is absent in `metacloud.yaml`, `meta-cli` must treat it as:

```yaml
driver: terraform-cloud
```

### Terraform Cloud example

```yaml
driver: terraform-cloud

terraform_cloud_org: my-org
terraform_cloud_workspace: infrastructure

git_provider: github
git_org: my-org
git_repo: infrastructure

yaml_dir: .
root_dir: _terraform
target_dir: _terraform
handler_version: "~> 2.5.0"
```

### Terramate example

```yaml
driver: terramate

git_provider: github
git_org: my-org
git_repo: infrastructure

yaml_dir: .
target_dir: _terraform
handler_version: "~> 1.0.0"

terraform_backend:
  name: s3
  configs:
    bucket: my-state-bucket
    region: eu-central-1
    key: terramate

linking_mode: terramate_outputs_sharing
mock_inputs_enabled: true
stack_id_prefix: null
```

### Terragrunt example

```yaml
driver: terragrunt

git_provider: github
git_org: my-org
git_repo: infrastructure

yaml_dir: .
target_dir: _terragrunt
handler_version: "~> 1.0.0"

terraform_backend:
  name: s3
  configs:
    bucket: my-state-bucket
    region: eu-central-1
    key: terragrunt
```

## CLI Behavior

### First run

`meta init` should:

- accept optional `--driver`
- default to `terraform-cloud` if `--driver` is omitted
- generate both:
  - `metacloud.yaml`
  - `_metacloud.tf`

### Later runs

If `metacloud.yaml` exists and `--force` is not used:

- read config from `metacloud.yaml`
- use the stored `driver`
- regenerate `_metacloud.tf`

### `--force`

If `--force` is used:

- allow regeneration of `metacloud.yaml`
- allow a new `--driver` to replace the old one

## `_metacloud.tf` Generation Rules

Generation should be split by driver.

### Terraform Cloud

Generate the existing module pattern using:

- `source = "dasmeta/cloud/tfe"`

Preserve the existing token-oriented flow and behavior.

### Terramate

Generate a module call using:

- `source = "dasmeta/cli/terramate"`

Pass through:

- `yamldir`
- `targetdir`
- `terraform_backend`
- optional:
  - `linking_mode`
  - `mock_inputs_enabled`
  - `stack_id_prefix`

### Terragrunt

Generate a module call using:

- `source = "dasmeta/cli/terragrunt"`

Pass through:

- `yamldir`
- `targetdir`
- `terraform_backend`

## Secrets and Environment Behavior

### Terraform Cloud

Continue existing behavior:

- fetch Terraform Cloud token from 1Password
- expose related `TF_VAR_*` and token env vars as today

### Terramate and Terragrunt

Do not add new 1Password secret requirements by default.

Instead:

- reuse existing AWS session/account environment setup from `meta exec`
- rely on environment-based AWS auth for backend and provider usage

## Internal Design Direction

Generation logic should be split into per-driver functions rather than one
monolithic string builder.

Recommended shape:

- `generateTerraformCloudTF`
- `generateTerramateTF`
- `generateTerragruntTF`
- one dispatcher:
  - `generateMetaCloudTF`

Common config parsing remains shared.

## Documentation Requirements

The README must be updated to include:

1. `meta init --driver ...` usage
2. default driver behavior
3. backward compatibility when `driver` is missing
4. example `metacloud.yaml` for:
   - Terraform Cloud
   - Terramate
   - Terragrunt
5. explanation of backend configuration for Terramate and Terragrunt
6. explanation of how `meta exec` fits into AWS-backed Terramate/Terragrunt use
7. generated `_metacloud.tf` examples or high-level snippets per driver

## Acceptance Criteria

1. Existing `metacloud.yaml` without `driver` still generates Terraform Cloud
   `_metacloud.tf`.
2. First run with no `--driver` generates Terraform Cloud config and module
   usage.
3. First run with `--driver terramate` generates Terramate config and module
   usage.
4. First run with `--driver terragrunt` generates Terragrunt config and module
   usage.
5. Later `meta init` runs use the driver stored in `metacloud.yaml`.
6. Terramate and Terragrunt generated `_metacloud.tf` include shared
   `terraform_backend` configuration.
7. Terraform Cloud-specific token handling is not required for Terramate or
   Terragrunt paths.
8. README examples match real generated behavior.

## Validation Scenarios

1. Legacy config compatibility:
   - existing `metacloud.yaml` without `driver`
   - regenerate `_metacloud.tf`
   - verify Terraform Cloud module remains selected
2. Terraform Cloud first run:
   - `meta init`
   - verify generated files and default driver
3. Terramate first run:
   - `meta init --driver terramate`
   - verify `metacloud.yaml`
   - verify `_metacloud.tf`
4. Terragrunt first run:
   - `meta init --driver terragrunt`
   - verify `metacloud.yaml`
   - verify `_metacloud.tf`
5. Re-run without flag:
   - ensure stored driver is reused
6. README/documentation consistency:
   - verify documented examples match output shape
