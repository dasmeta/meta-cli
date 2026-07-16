# Terramate driver examples

Based on [terraform-terramate-cli](https://github.com/dasmeta/terraform-terramate-cli) backend and linked-stack examples.

## Backend variants

| Folder | Backend | Notes |
|--------|---------|-------|
| [basic-s3-backend/](./basic-s3-backend/) | AWS S3 | Default `meta init` style; `terramate_outputs_sharing` |
| [basic-gitlab-backend/](./basic-gitlab-backend/) | GitLab HTTP | `remote_state` linking mode |
| [basic-gcs-backend/](./basic-gcs-backend/) | Google GCS | Replace bucket/prefix with your state bucket |
| [basic-azure-backend/](./basic-azure-backend/) | Azure Blob (`azurerm`) | Replace RG, storage account, container, key |
| [basic-local-backend/](./basic-local-backend/) | Local filesystem | For local dev only; state under `.terraform-state/` |

All variants share the same YAML module layout:

```text
.
├── metacloud.yaml
├── _.yaml
├── group-0/
│   ├── module-a.yaml
│   └── module-b.yaml    # links to module-a
└── group-1/
    └── module-c.yaml    # links to module-a and module-b
```

YAML files live in the example root (default `yaml_dir: .`).

## Commands

```bash
cd basic-s3-backend   # or another backend variant
meta init             # driver comes from metacloud.yaml
meta validate
meta plan --setup group-0/module-a
meta apply --setup group-1/module-c
```

Use `meta exec` (or cloud credentials) for remote backends. Replace placeholder backend values before real runs.
