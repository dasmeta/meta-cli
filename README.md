oclif-hello-world
=================

oclif example Hello World CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![GitHub license](https://img.shields.io/github/license/oclif/hello-world)](https://github.com/oclif/hello-world/blob/main/LICENSE)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @dasmeta/meta-cli
$ meta COMMAND
running command...
$ meta (--version)
@dasmeta/meta-cli/0.0.0 darwin-arm64 node-v18.19.0
$ meta --help [COMMAND]
USAGE
  $ meta COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`meta auth`](#meta-auth)
* [`meta configure`](#meta-configure)
* [`meta exec ACCOUNT ENV`](#meta-exec-account-env)
* [`meta help [COMMANDS]`](#meta-help-commands)
* [`meta init`](#meta-init)
* [`meta open ACCOUNT ENV`](#meta-open-account-env)
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

## `meta auth`

describe the command here

```
USAGE
  $ meta auth

DESCRIPTION
  describe the command here

EXAMPLES
  $ meta auth
```

_See code: [src/commands/auth.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/auth.ts)_

## `meta configure`

describe the command here

```
USAGE
  $ meta configure

DESCRIPTION
  describe the command here

EXAMPLES
  $ meta configure
```

_See code: [src/commands/configure.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/configure.ts)_

## `meta exec ACCOUNT ENV`

describe the command here

```
USAGE
  $ meta exec ACCOUNT ENV

ARGUMENTS
  ACCOUNT  account name to connect
  ENV      environment you want to use

DESCRIPTION
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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.10/src/commands/help.ts)_

## `meta init`

generates metacloud.yaml and _metacloud.tf files and openes new shell with generated environment variables

```
USAGE
  $ meta init [-f]

FLAGS
  -f, --force  Force (regenerates config)

DESCRIPTION
  generates metacloud.yaml and _metacloud.tf files and openes new shell with generated environment variables

EXAMPLES
  $ meta init

  $ meta init --force
```

_See code: [src/commands/init.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/init.ts)_

## `meta open ACCOUNT ENV`

describe the command here

```
USAGE
  $ meta open ACCOUNT ENV

ARGUMENTS
  ACCOUNT  account name to connect
  ENV      environment you want to use

DESCRIPTION
  describe the command here

EXAMPLES
  $ meta open
```

_See code: [src/commands/open.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/open.ts)_

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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.15/src/commands/plugins/index.ts)_

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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.15/src/commands/plugins/inspect.ts)_

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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.15/src/commands/plugins/install.ts)_

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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.15/src/commands/plugins/link.ts)_

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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.15/src/commands/plugins/reset.ts)_

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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.15/src/commands/plugins/uninstall.ts)_

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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.1.15/src/commands/plugins/update.ts)_

## `meta refresh`

describe the command here

```
USAGE
  $ meta refresh

DESCRIPTION
  describe the command here

EXAMPLES
  $ meta refresh
```

_See code: [src/commands/refresh.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/refresh.ts)_

## `meta scan`

generates metacloud.yaml and _metacloud.tf files and openes new shell with generated environment variables

```
USAGE
  $ meta scan [--log-level 1|2]

FLAGS
  --log-level=<option>  Defines log level (1 = scan processing, 2 = unassociated components)
                        <options: 1|2>

DESCRIPTION
  generates metacloud.yaml and _metacloud.tf files and openes new shell with generated environment variables

EXAMPLES
  $ meta scan

  $ meta scan --force
```

_See code: [src/commands/scan.ts](https://github.com/dasmeta/meta-cli/blob/v0.0.0/src/commands/scan.ts)_
<!-- commandsstop -->
