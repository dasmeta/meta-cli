# Tasks: Multi-driver `meta init`

## 1. Config model

- [x] Extend `MetaConfig` to support `driver`, shared `terraform_backend`, and Terramate-specific optional fields.
- [x] Normalize `metacloud.yaml` parsing so missing `driver` defaults to `terraform-cloud`.
- [x] Generate `metacloud.yaml` from structured config instead of manual string concatenation.

## 2. `_metacloud.tf` generation

- [x] Split `_metacloud.tf` generation into per-driver functions for Terraform Cloud, Terramate, and Terragrunt.
- [x] Preserve existing Terraform Cloud generation semantics.
- [x] Add Terramate and Terragrunt module generation with shared backend support.

## 3. `meta init` flow

- [x] Add `--driver` flag to `meta init`.
- [x] Keep first-run default driver as `terraform-cloud`.
- [x] Keep later runs driven by `metacloud.yaml` without requiring `--driver`.
- [x] Prompt for backend configuration when generating Terramate or Terragrunt config.
- [x] Restrict Terraform Cloud token retrieval to the Terraform Cloud driver path.

## 4. Tests

- [x] Remove stock placeholder command tests that do not reflect this repository.
- [x] Add focused utility tests for config normalization and per-driver generation.

## 5. Documentation

- [x] Document the multi-driver `meta init` workflow in `README.md`.
- [x] Add example `metacloud.yaml` files for Terraform Cloud, Terramate, and Terragrunt.
- [x] Document default/backward-compatible Terraform Cloud behavior.

## 6. Verification

- [x] Run focused utility tests.
- [x] Run TypeScript build.
- [ ] Resolve pre-existing repository-wide ESLint debt outside this feature scope.
