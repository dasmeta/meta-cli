# meta-cli driver examples

Reference layouts for each supported `metacloud.yaml` driver.

## Layout

| Driver | Examples |
|--------|----------|
| [terraform-cloud](./terraform-cloud/) | `basic/`, `advanced/` (linked workspaces) |
| [terramate](./terramate/) | `basic-*-backend/` — S3, GitLab HTTP, GCS, Azure, local |
| [terragrunt](./terragrunt/) | `basic-*-backend/` — S3, GitLab HTTP, GCS, Azure, local |

Terramate and Terragrunt examples use YAML at the repo root (default `yaml_dir: .`). Each backend variant shares the same multi-module layout with cross-linking across `group-0` and `group-1/module-c`.

Generated `_metacloud.tf` and driver output directories are gitignored per driver — see each driver's `.gitignore`.

## Usage

Copy an example folder into a real infrastructure repository, adjust backend values, then:

```bash
meta init
meta validate
```
