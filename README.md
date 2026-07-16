@dasmeta/meta-cli
=================

CLI tool for DasMeta infrastructure workflows. `meta init` bootstraps generated infrastructure handlers (`metacloud.yaml`, `_metacloud.tf`). `meta exec` opens an AWS-authenticated shell — **required for the `terraform-cloud` driver**, optional for other drivers depending on backend/credentials.

`meta init` now supports multiple drivers:
- `terraform-cloud`
- `terramate`
- `terragrunt`

Wrapper commands are also available:
- `meta validate`
- `meta plan`
- `meta apply`
- `meta destroy`

Backward compatibility is preserved:
- if `metacloud.yaml` has no `driver`, `meta` treats it as `terraform-cloud`
- first-time `meta init` without `--driver` still defaults to `terraform-cloud`

<!-- toc -->
* [Prerequisites](#prerequisites)
* [Supported Node.js versions](#supported-nodejs-versions)
* [Usage](#usage)
* [Init Workflow](#init-workflow)
* [metacloud.yaml Examples](#metacloudyaml-examples)
* [Wrapper Commands](#wrapper-commands)
* [Commands](#commands)
<!-- tocstop -->
# Prerequisites

Install via npm (global):

```bash
npm install -g @dasmeta/meta-cli
```

# Supported Node.js versions

`meta` requires a supported Node.js runtime. The requirement is declared in `package.json`:

```json
"engines": { "node": ">=18" }
```

| Node.js | Status | Notes |
|---------|--------|-------|
| **18.x** | Supported (LTS) | CI-tested on every push/PR |
| **20.x** | Supported (LTS) | CI-tested on every push/PR |
| **22.x** | Supported (LTS) | CI-tested on every push/PR |
| **24.x+** | Best effort | Not in CI matrix yet; install/`meta --help` smoke-tested in Docker |
| **16.x and below** | Not supported | Below `engines.node`; may fail at install or runtime |

**Patch versions:** any patch within a supported major is fine (e.g. `18.20.4`, `20.16.0`, `22.5.1`). No exact Node patch is required.

**npm:** use npm 9+ (bundled with Node 18+). On Node 24 / npm 11, lifecycle scripts may require script approval; autocomplete still runs on the first `meta` command if postinstall is skipped.

## Shell autocomplete

Shell tab completion is configured automatically on global install:
- builds the autocomplete cache during `postinstall`
- appends the shell hook to `~/.zshrc` or `~/.bashrc` when missing (interactive installs only)

If npm skips lifecycle scripts (npm 11+ `allow-scripts`), the cache is built on the first `meta` run instead.

Opt out: `META_SKIP_AUTOCOMPLETE=1 npm install -g @dasmeta/meta-cli`

Manual refresh or re-print setup: `meta autocomplete`

## Local development

For local development from this repository:

```bash
yarn install
yarn build
./bin/dev.js --help    # development entrypoint (TypeScript)
./bin/run.js --help    # production entrypoint (compiled dist/)
```

# Usage
<!-- usage -->
```sh-session
$ npm install -g @dasmeta/meta-cli
$ meta COMMAND
running command...
$ meta (--version)
@dasmeta/meta-cli/0.0.0 darwin-arm64 node-v22.5.1
$ meta --help [COMMAND]
USAGE
  $ meta COMMAND
...
```
<!-- usagestop -->
# Init Workflow

## When `meta exec` is required

| Driver | `meta exec` before `meta init`? | Why |
|--------|----------------------------------|-----|
| `terraform-cloud` | **Yes** | Needs an active client session (`META_CLIENT_NAME`), AWS env, and 1Password-backed Terraform Cloud / Git tokens |
| `terramate` | **No** (when `metacloud.yaml` exists) | Run `meta init` directly to regenerate `_metacloud.tf` from `metacloud.yaml` |
| `terragrunt` | **No** (when `metacloud.yaml` exists) | Same as Terramate — no `meta exec` for init/regenerate |

For `terramate` / `terragrunt`, use `meta exec` only when you need AWS (or other cloud) credentials for remote backends or for `meta plan` / `meta apply` / `meta destroy`.

## First-time setup

### Terraform Cloud

```bash
meta exec <account> <env>    # required first
meta init                    # or: meta init --driver terraform-cloud
```

Inside the `meta exec` shell, `meta init` prompts for Terraform Cloud org/workspace, Git metadata, and fetches TFC/Git tokens from 1Password.

### Terramate / Terragrunt

When `metacloud.yaml` is already in the repo (typical for driver repos):

```bash
meta init                    # regenerates _metacloud.tf from metacloud.yaml
# or locally from meta-cli source:
meta-dev init --driver terramate
```

No `meta exec` session is required for this regenerate flow.

First-time creation of `metacloud.yaml` (no file yet) still runs inside a shell with client context if you use the interactive `meta init` prompts; prefer committing a starter `metacloud.yaml` for Terramate/Terragrunt repos (see [examples/](./examples/)).

## Outputs

`meta init` generates or refreshes:

- `metacloud.yaml`
- `_metacloud.tf`
- `.vscode/settings.json` YAML schema mappings (VS Code / Cursor; see [IDE YAML schemas](#ide-yaml-schemas))

On later runs, `meta init` reads `metacloud.yaml` and regenerates `_metacloud.tf` from it.

## IDE YAML schemas

MetaCloud JSON schemas ship inside `@dasmeta/meta-cli` under `schemas/metacloud/`. They are also available from npm via unpkg, for example:

`https://unpkg.com/@dasmeta/meta-cli@<version>/schemas/metacloud/workspace.schema.json`

On every `meta init`, meta-cli merges `yaml.schemas` into the nearest `.vscode/settings.json` (walking up to the git root). By default it references the published unpkg URLs for the installed package version, so you do not need to copy schema files into your repo.

```bash
meta init                              # remote schemas (default after publish)
meta init --ide-schemas local          # copy bundled schemas into .vscode/schemas/metacloud
meta init --skip-ide-schemas           # skip IDE setup
```

Requires the [Red Hat YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) in VS Code or Cursor.

## Examples

```bash
meta init
meta init --driver terraform-cloud
meta init --driver terramate
meta init --driver terragrunt
```

Behavior:
- if `metacloud.yaml` exists and `--force` is not used, the driver from the file is used
- if `metacloud.yaml` exists but has no `driver`, `terraform-cloud` is assumed
- if `--force` is used, `meta init` prompts again and rewrites `metacloud.yaml`

Driver-specific notes:
- `terraform-cloud`
  - **requires `meta exec`** before init
  - requires `git_provider`, `git_org`, and `git_repo` in `metacloud.yaml` (used by `dasmeta/cloud/tfe` for VCS-linked modules)
  - keeps the Terraform Cloud and 1Password token flow
  - fetches Terraform Cloud and Git tokens from 1Password
- `terramate`
  - **does not require `meta exec` for init** when `metacloud.yaml` exists
  - `git_*` fields are not used — omit them
  - uses a shared `terraform_backend` block from `metacloud.yaml`
  - defaults generated stacks to `_terraform`
  - defaults `linking_mode` to `terramate_outputs_sharing`
  - defaults `mock_inputs_enabled` to `true`
- `terragrunt`
  - **does not require `meta exec` for init** when `metacloud.yaml` exists
  - `git_*` fields are not used — omit them
  - uses a shared `terraform_backend` block from `metacloud.yaml`
  - defaults generated units to `_terragrunt`

AWS environment:
- `meta exec` provides AWS credentials and SSO session environment (required for `terraform-cloud` init; optional for Terramate/Terragrunt depending on backend)
- Terramate and Terragrunt do not require new 1Password secrets by default

# metacloud.yaml Examples

Full minimal layouts per driver live in [examples/](./examples/).

Terraform Cloud:

```yaml
driver: terraform-cloud
terraform_cloud_org: dasmeta
terraform_cloud_workspace: infrastructure
git_provider: github
git_org: dasmeta
git_repo: infrastructure
```

Terramate:

```yaml
driver: terramate
yaml_dir: .
target_dir: _terraform
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

Terragrunt:

```yaml
driver: terragrunt
yaml_dir: .
target_dir: _terragrunt
terraform_backend:
  name: s3
  configs:
    bucket: my-state-bucket
    region: eu-central-1
    key: terragrunt
```

Generated `_metacloud.tf` shape:
- Terraform Cloud renders `terraform { cloud { ... } }` plus `dasmeta/cloud/tfe`
- Terramate renders root `terraform { backend ... }` (bootstrap state) plus `dasmeta/cli/terramate`
- Terragrunt renders root `terraform { backend ... }` (bootstrap state) plus `dasmeta/cli/terragrunt`

For Terramate and Terragrunt, `terraform_backend` in `metacloud.yaml` is used twice:
1. root `terraform { backend ... }` block — state for the driver workspace itself
2. `module "metacloud" { terraform_backend = ... }` — default backend for generated child stacks

Common Terramate and Terragrunt backend guidance:
- use one shared `terraform_backend` block in `metacloud.yaml`
- use `s3` for real shared state
- use `local` only for local testing

## Bootstrap backend resources

`meta tf-bootstrap-backend` creates the remote backend object described in `metacloud.yaml`. It prints the provider CLI commands that will run, waits for confirmation, then provisions resources:

| Driver / backend | Tool | Creates |
|------------------|------|---------|
| `terraform-cloud` | Terraform Cloud API (`curl` / axios) | Workspace with **local execution mode** (CLI-driven runs, remote state) |
| `s3` | AWS CLI | Versioned, encrypted S3 bucket with public access blocked |
| `azurerm` | Azure CLI | Resource group, storage account, blob container |
| `gcs` | gcloud CLI | GCS bucket with versioning |

```bash
cd terramate/   # directory with metacloud.yaml
meta tf-bootstrap-backend
meta tf-bootstrap-backend --yes          # skip confirmation
meta tf-bootstrap-backend --dir ./terramate --location westeurope
```

Requirements:
- `metacloud.yaml` must already define the target backend (`terraform_backend` or `terraform_cloud_*`)
- Cloud credentials must be available in the shell (`aws`, `az`, or `gcloud` logged in; `TF_TOKEN_app_terraform_io` or `meta exec` + 1Password for Terraform Cloud)
- Existing resources are detected and skipped (idempotent)

# Wrapper Commands

`meta validate`, `meta plan`, `meta apply`, and `meta destroy` read `metacloud.yaml`, detect the configured driver, and run the appropriate underlying tool with driver-specific defaults.

Common flags:
- `--dir <path>`
  - override the generated driver directory
- `--setup <selector>`
  - target one or more setups by exact relative path or exact basename
  - supports repeated flags and comma-separated values
- `--`
  - pass raw extra arguments through to the underlying tool

Examples:

```bash
meta validate
meta plan --setup group-0/module-a
meta apply --setup group-0/module-a,group-2/dns-zone
meta destroy --setup group-3/dns-records --setup group-2/dns-zone
meta plan -- --lock-timeout=5m
meta apply --dir custom-output -- -parallelism=20
```

Setup selector rules:
- exact relative path matches are preferred
- exact basenames are allowed only when they are unique
- ambiguous basenames fail and require a path-form selector

Driver behavior:
- `terraform-cloud`
  - operates per generated Terraform setup directory
  - `validate` tries `terraform validate` first and runs `terraform init -backend=false` only if the error indicates init is required
  - `plan`, `apply`, and `destroy` try the requested action first and run `terraform init` only if the error indicates init is required
- `terramate`
  - `validate` runs:
    - `terramate generate`
    - `terramate run --enable-sharing --mock-on-fail --disable-safeguards=git-untracked,git-uncommitted -- terraform validate`
    - if init is required, it runs `terramate run -- terraform init` and retries once
  - `plan` and `apply` use:
    - `--enable-sharing`
    - `--mock-on-fail`
    - `--disable-safeguards=git-untracked,git-uncommitted`
    - and run `terramate run -- terraform init` only when the first failure indicates init is required
  - `destroy` uses:
    - `--enable-sharing`
    - `--disable-safeguards=git-untracked,git-uncommitted`
    - `--reverse`
    - and runs `terramate run -- terraform init` only when the first failure indicates init is required
  - `apply` and `destroy` remain interactive by default
- `terragrunt`
  - when no `--setup` is provided, runs `terragrunt run --all`
  - `validate` tries `validate` first and runs `init -backend=false` only if the error indicates init is required
  - `apply` and `destroy` use `--no-auto-approve` when running with `--all`
  - `plan`, `apply`, and `destroy` run `init` only when the first failure indicates init is required

Missing tool handling:
- if a required executable is missing, the wrapper stops early
- the error includes quick install commands for macOS and Linux

# Commands
<!-- commands -->
* [`meta apply`](#meta-apply)
* [`meta auth`](#meta-auth)
* [`meta configure`](#meta-configure)
* [`meta destroy`](#meta-destroy)
* [`meta exec ACCOUNT ENV`](#meta-exec-account-env)
* [`meta help [COMMANDS]`](#meta-help-commands)
* [`meta list`](#meta-list)
* [`meta init`](#meta-init)
* [`meta open ACCOUNT ENV`](#meta-open-account-env)
* [`meta plan`](#meta-plan)
* [`meta plugins`](#meta-plugins)
* [`meta plugins:install PLUGIN...`](#meta-pluginsinstall-plugin)
* [`meta plugins:inspect PLUGIN...`](#meta-pluginsinspect-plugin)
* [`meta plugins:install PLUGIN...`](#meta-pluginsinstall-plugin-1)
* [`meta plugins:link PLUGIN`](#meta-pluginslink-plugin)
* [`meta plugins:uninstall PLUGIN...`](#meta-pluginsuninstall-plugin)
* [`meta plugins reset`](#meta-plugins-reset)
* [`meta plugins:uninstall PLUGIN...`](#meta-pluginsuninstall-plugin-1)
* [`meta plugins:uninstall PLUGIN...`](#meta-pluginsuninstall-plugin-2)
* [`meta plugins update`](#meta-plugins-update)
* [`meta refresh`](#meta-refresh)
* [`meta scan`](#meta-scan)
* [`meta tfa`](#meta-tfa)
* [`meta tfd`](#meta-tfd)
* [`meta tfi`](#meta-tfi)
* [`meta tfp`](#meta-tfp)
* [`meta validate`](#meta-validate)
* [`meta validate-yaml`](#meta-validate-yaml)

## `meta apply`

Apply generated setups via the configured driver

```
USAGE
  $ meta apply [--dir <value>] [--driver terraform-cloud|terramate|terragrunt] [--setup <value>]

FLAGS
  --dir=<value>       Override the generated driver directory
  --driver=<option>   Driver to use when metacloud.yaml is absent (terramate, terragrunt, terraform-cloud)
                      <options: terraform-cloud|terramate|terragrunt>
  --setup=<value>...  Setup name or relative path. Supports repeated flags and comma-separated values.

DESCRIPTION
  Apply generated setups via the configured driver

  apply generated infrastructure using the configured driver wrapper

EXAMPLES
  $ meta apply

  $ meta apply --setup group-0/module-a

  $ meta apply --driver terramate

  $ meta apply -- --lock-timeout=5m
```

_See code: [src/commands/apply.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/apply.ts)_

## `meta auth`

Authenticate meta CLI with the DasMeta backend

```
USAGE
  $ meta auth

DESCRIPTION
  Authenticate meta CLI with the DasMeta backend

  describe the command here

EXAMPLES
  $ meta auth
```

_See code: [src/commands/auth.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/auth.ts)_

## `meta configure`

Configure meta CLI settings

```
USAGE
  $ meta configure

DESCRIPTION
  Configure meta CLI settings

  describe the command here

EXAMPLES
  $ meta configure
```

_See code: [src/commands/configure.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/configure.ts)_

## `meta destroy`

Destroy generated setups via the configured driver

```
USAGE
  $ meta destroy [--dir <value>] [--driver terraform-cloud|terramate|terragrunt] [--setup <value>]

FLAGS
  --dir=<value>       Override the generated driver directory
  --driver=<option>   Driver to use when metacloud.yaml is absent (terramate, terragrunt, terraform-cloud)
                      <options: terraform-cloud|terramate|terragrunt>
  --setup=<value>...  Setup name or relative path. Supports repeated flags and comma-separated values.

DESCRIPTION
  Destroy generated setups via the configured driver

  destroy generated infrastructure using the configured driver wrapper

EXAMPLES
  $ meta destroy

  $ meta destroy --setup group-2/dns-zone,group-3/dns-records

  $ meta destroy --driver terramate

  $ meta destroy -- --lock-timeout=5m
```

_See code: [src/commands/destroy.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/destroy.ts)_

## `meta exec ACCOUNT ENV`

Open a shell with AWS credentials for a client environment

```
USAGE
  $ meta exec ACCOUNT ENV

ARGUMENTS
  ACCOUNT  account name to connect
  ENV      environment you want to use

DESCRIPTION
  Open a shell with AWS credentials for a client environment

  describe the command here

EXAMPLES
  $ meta exec
```

_See code: [src/commands/exec.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/exec.ts)_

## `meta help [COMMANDS]`

Display help for meta.

```
USAGE
  $ meta help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for meta.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.12/src/commands/help.ts)_

## `meta init`

Generate metacloud.yaml and _metacloud.tf, then open a configured shell

```
USAGE
  $ meta init [-f] [--driver terraform-cloud|terramate|terragrunt]

FLAGS
  -f, --force            Force (regenerates config)
      --driver=<option>  Driver to generate on first run or when used with --force
                         <options: terraform-cloud|terramate|terragrunt>

DESCRIPTION
  Generate metacloud.yaml and _metacloud.tf, then open a configured shell

  generates metacloud.yaml and _metacloud.tf files and openes new shell with generated environment variables

EXAMPLES
  $ meta init

  $ meta init --force

  $ meta init --driver terramate
```

_See code: [src/commands/init.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/init.ts)_

## `meta open ACCOUNT ENV`

Open the AWS console for a client environment

```
USAGE
  $ meta open ACCOUNT ENV

ARGUMENTS
  ACCOUNT  account name to connect
  ENV      environment you want to use

DESCRIPTION
  Open the AWS console for a client environment

  describe the command here

EXAMPLES
  $ meta open
```

_See code: [src/commands/open.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/open.ts)_

## `meta plan`

Plan generated setups via the configured driver

```
USAGE
  $ meta plan [--dir <value>] [--driver terraform-cloud|terramate|terragrunt] [--setup <value>]

FLAGS
  --dir=<value>       Override the generated driver directory
  --driver=<option>   Driver to use when metacloud.yaml is absent (terramate, terragrunt, terraform-cloud)
                      <options: terraform-cloud|terramate|terragrunt>
  --setup=<value>...  Setup name or relative path. Supports repeated flags and comma-separated values.

DESCRIPTION
  Plan generated setups via the configured driver

  plan generated infrastructure using the configured driver wrapper

EXAMPLES
  $ meta plan

  $ meta plan --setup group-0/module-a,group-2/dns-zone

  $ meta plan --driver terramate

  $ meta plan -- --lock-timeout=5m
```

_See code: [src/commands/plan.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/plan.ts)_

## `meta plugins`

List installed plugins.

```
USAGE
  $ meta plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ meta plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.21/src/commands/plugins/index.ts)_

## `meta plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ meta plugins add plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -s, --silent   Silences yarn output.
  -v, --verbose  Show verbose yarn output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ meta plugins add

EXAMPLES
  $ meta plugins add myplugin 

  $ meta plugins add https://github.com/someuser/someplugin

  $ meta plugins add someuser/someplugin
```

## `meta plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ meta plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ meta plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.21/src/commands/plugins/inspect.ts)_

## `meta plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ meta plugins install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -s, --silent   Silences yarn output.
  -v, --verbose  Show verbose yarn output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ meta plugins add

EXAMPLES
  $ meta plugins install myplugin 

  $ meta plugins install https://github.com/someuser/someplugin

  $ meta plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.21/src/commands/plugins/install.ts)_

## `meta plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ meta plugins link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ meta plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.21/src/commands/plugins/link.ts)_

## `meta plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ meta plugins remove plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ meta plugins unlink
  $ meta plugins remove

EXAMPLES
  $ meta plugins remove myplugin
```

## `meta plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ meta plugins reset
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.21/src/commands/plugins/reset.ts)_

## `meta plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ meta plugins uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ meta plugins unlink
  $ meta plugins remove

EXAMPLES
  $ meta plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.21/src/commands/plugins/uninstall.ts)_

## `meta plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ meta plugins unlink plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ meta plugins unlink
  $ meta plugins remove

EXAMPLES
  $ meta plugins unlink myplugin
```

## `meta plugins update`

Update installed plugins.

```
USAGE
  $ meta plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.21/src/commands/plugins/update.ts)_

## `meta refresh`

Refresh cached account and environment metadata

```
USAGE
  $ meta refresh

DESCRIPTION
  Refresh cached account and environment metadata

  describe the command here

EXAMPLES
  $ meta refresh
```

_See code: [src/commands/refresh.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/refresh.ts)_

## `meta scan`

Scan cloud resources and suggest infrastructure modules

```
USAGE
  $ meta scan [--log-level 1|2]

FLAGS
  --log-level=<option>  Defines log level (1 = scan processing, 2 = unassociated components)
                        <options: 1|2>

DESCRIPTION
  Scan cloud resources and suggest infrastructure modules

  generates metacloud.yaml and _metacloud.tf files and openes new shell with generated environment variables

EXAMPLES
  $ meta scan

  $ meta scan --force
```

_See code: [src/commands/scan.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/scan.ts)_

## `meta tfa`

Terraform apply for the current workspace

```
USAGE
  $ meta tfa

DESCRIPTION
  Terraform apply for the current workspace

  run terraform apply in the current directory when it contains _metacloud.tf or other Terraform root files (*.tf)

EXAMPLES
  $ meta tfa

  $ meta tfa -auto-approve

  $ meta tfa -- -auto-approve
```

_See code: [src/commands/tfa.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/tfa.ts)_

## `meta tfd`

Terraform destroy for the current workspace

```
USAGE
  $ meta tfd

DESCRIPTION
  Terraform destroy for the current workspace

  run terraform destroy in the current directory when it contains _metacloud.tf or other Terraform root files (*.tf)

EXAMPLES
  $ meta tfd

  $ meta tfd -auto-approve

  $ meta tfd -- -auto-approve
```

_See code: [src/commands/tfd.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/tfd.ts)_

## `meta tfi`

Terraform init for the current workspace

```
USAGE
  $ meta tfi

DESCRIPTION
  Terraform init for the current workspace

  run terraform init in the current directory when it contains _metacloud.tf or other Terraform root files (*.tf)

EXAMPLES
  $ meta tfi

  $ meta tfi -upgrade

  $ meta tfi -- -upgrade
```

_See code: [src/commands/tfi.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/tfi.ts)_

## `meta tfp`

Terraform plan for the current workspace

```
USAGE
  $ meta tfp

DESCRIPTION
  Terraform plan for the current workspace

  run terraform plan in the current directory when it contains _metacloud.tf or other Terraform root files (*.tf)

EXAMPLES
  $ meta tfp

  $ meta tfp -target=module.example

  $ meta tfp -- -lock-timeout=5m
```

_See code: [src/commands/tfp.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/tfp.ts)_

## `meta validate`

Validate generated setups via the configured driver

```
USAGE
  $ meta validate [--dir <value>] [--driver terraform-cloud|terramate|terragrunt] [--setup <value>]

FLAGS
  --dir=<value>       Override the generated driver directory
  --driver=<option>   Driver to use when metacloud.yaml is absent (terramate, terragrunt, terraform-cloud)
                      <options: terraform-cloud|terramate|terragrunt>
  --setup=<value>...  Setup name or relative path. Supports repeated flags and comma-separated values.

DESCRIPTION
  Validate generated setups via the configured driver

  validate generated infrastructure using the configured driver wrapper

EXAMPLES
  $ meta validate

  $ meta validate --setup group-0/module-a

  $ meta validate --driver terramate

  $ meta validate -- --no-color
```

_See code: [src/commands/validate.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/validate.ts)_

## `meta list`

List infrastructure YAML setups

```
USAGE
  $ meta list [--yaml-dir <value>]

FLAGS
  --yaml-dir=<value>  Directory containing infrastructure YAML (default: yaml_dir from metacloud.yaml or .)

DESCRIPTION
  List setup YAML definitions (same discovery as validate-yaml, without validation)

  Output uses the general **Setups** term with the driver-specific kind in parentheses:
  **Stacks** (terramate), **Units** (terragrunt), **Workspaces** (terraform-cloud).

EXAMPLES
  $ meta list

  $ meta list --yaml-dir ./infra
```

_See code: [src/commands/list.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/list.ts)_

## `meta validate-yaml`

Validate MetaCloud and infrastructure YAML configuration

```
USAGE
  $ meta validate-yaml [--yaml-dir <value>] [--strict]

FLAGS
  --strict            Treat warnings as errors
  --yaml-dir=<value>  Directory containing infrastructure YAML (default: yaml_dir from metacloud.yaml or .)

DESCRIPTION
  Validate MetaCloud and infrastructure YAML configuration

  validate infrastructure YAML (metacloud.yaml when present, otherwise workspace YAML in the current or selected
  directory)

EXAMPLES
  $ meta validate-yaml

  $ meta validate-yaml --yaml-dir ./infra

  $ meta validate-yaml --strict
```

_See code: [src/commands/validate-yaml.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/validate-yaml.ts)_
<!-- commandsstop -->
