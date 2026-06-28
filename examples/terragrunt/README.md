# Terragrunt driver examples

Based on [terraform-terragrunt-cli](https://github.com/dasmeta/terraform-terragrunt-cli) basic and linked-stack examples.

## Backend variants

| Folder | Backend | Notes |
|--------|---------|-------|
| [basic-s3-backend/](./basic-s3-backend/) | AWS S3 | Default `meta init` style |
| [basic-gitlab-backend/](./basic-gitlab-backend/) | GitLab HTTP | Replace URL and credentials |
| [basic-gcs-backend/](./basic-gcs-backend/) | Google GCS | Replace bucket/prefix |
| [basic-azure-backend/](./basic-azure-backend/) | Azure Blob (`azurerm`) | Replace RG, storage account, container, key |
| [basic-local-backend/](./basic-local-backend/) | Local filesystem | State under `.terragrunt-state/` |

All variants share the same YAML module layout:

```text
.
├── metacloud.yaml
├── _.yaml
├── group-0/
│   ├── module-a.yaml
│   └── module-b.yaml    # linked_workspaces → module-a
└── group-1/
    └── module-c.yaml    # linked_workspaces → module-a, module-b
```

YAML files live in the example root (default `yaml_dir: .`).

## Commands

When `metacloud.yaml` exists, run `meta init` (or `meta-dev init` locally) without `--driver`:

```bash
cd basic-local-backend
meta-dev init          # regenerates _metacloud.tf without meta exec
meta-dev tfi           # terraform init for _metacloud.tf generation workspace
meta-dev tfa           # terraform apply to generate _terragrunt/ from YAML
meta-dev validate      # driver wrapper: terragrunt validate on generated units

# for remote backends or when using meta init subshell with AWS credentials:
meta-dev exec <account> <env>
meta init
```

Use `meta exec` for AWS S3. Configure GCP/Azure credentials for GCS/Azure backends. Replace GitLab placeholder credentials before real runs.
