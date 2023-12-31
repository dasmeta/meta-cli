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
@dasmeta/meta-cli/0.0.0 darwin-arm64 node-v18.18.0
$ meta --help [COMMAND]
USAGE
  $ meta COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`meta hello PERSON`](#meta-hello-person)
* [`meta hello world`](#meta-hello-world)
* [`meta help [COMMANDS]`](#meta-help-commands)
* [`meta plugins`](#meta-plugins)
* [`meta plugins:install PLUGIN...`](#meta-pluginsinstall-plugin)
* [`meta plugins:inspect PLUGIN...`](#meta-pluginsinspect-plugin)
* [`meta plugins:install PLUGIN...`](#meta-pluginsinstall-plugin-1)
* [`meta plugins:link PLUGIN`](#meta-pluginslink-plugin)
* [`meta plugins:uninstall PLUGIN...`](#meta-pluginsuninstall-plugin)
* [`meta plugins:uninstall PLUGIN...`](#meta-pluginsuninstall-plugin-1)
* [`meta plugins:uninstall PLUGIN...`](#meta-pluginsuninstall-plugin-2)
* [`meta plugins update`](#meta-plugins-update)

## `meta hello PERSON`

Say hello

```
USAGE
  $ meta hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ oex hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/dasmeta/meta0cli/blob/v0.0.0/src/commands/hello/index.ts)_

## `meta hello world`

Say hello world

```
USAGE
  $ meta hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ meta hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/dasmeta/meta0cli/blob/v0.0.0/src/commands/hello/world.ts)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.20/src/commands/help.ts)_

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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v3.8.4/src/commands/plugins/index.ts)_

## `meta plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ meta plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

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
  $ meta plugins:install myplugin 

  $ meta plugins:install https://github.com/someuser/someplugin

  $ meta plugins:install someuser/someplugin
```

## `meta plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ meta plugins:inspect PLUGIN...

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
  $ meta plugins:inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v3.8.4/src/commands/plugins/inspect.ts)_

## `meta plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ meta plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

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
  $ meta plugins:install myplugin 

  $ meta plugins:install https://github.com/someuser/someplugin

  $ meta plugins:install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v3.8.4/src/commands/plugins/install.ts)_

## `meta plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ meta plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ meta plugins:link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v3.8.4/src/commands/plugins/link.ts)_

## `meta plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ meta plugins:uninstall PLUGIN...

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
```

## `meta plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ meta plugins:uninstall PLUGIN...

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
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v3.8.4/src/commands/plugins/uninstall.ts)_

## `meta plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ meta plugins:uninstall PLUGIN...

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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v3.8.4/src/commands/plugins/update.ts)_
<!-- commandsstop -->
