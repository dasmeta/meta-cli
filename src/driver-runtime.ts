import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import chalk from 'chalk';

import type { MetaConfig, MetaDriver } from './utils';

export type DriverAction = 'validate' | 'plan' | 'apply' | 'destroy';

export type CommandInvocation = {
  binary: string;
  args: string[];
  cwd?: string;
};

export type ExecutionPlan = {
  commands: CommandInvocation[];
  requiredTools: string[];
  targetDir: string;
};

type CommandResult = {
  code: number | null;
  output: string;
};

const DRIVER_DEFAULT_DIRS: Record<MetaDriver, string> = {
  'terraform-cloud': '_terraform',
  terragrunt: '_terragrunt',
  terramate: '_terraform',
};

const SETUP_MARKERS: Record<MetaDriver, string> = {
  'terraform-cloud': 'main.tf',
  terragrunt: 'terragrunt.hcl',
  terramate: 'stack.tm.hcl',
};

function getDriver(config: MetaConfig): MetaDriver {
  return config.driver || 'terraform-cloud';
}

function getTargetDir(config: MetaConfig, cwd: string, overrideDir?: string): string {
  const driver = getDriver(config);
  const configuredDir = overrideDir || config.targetDir || DRIVER_DEFAULT_DIRS[driver];

  return path.resolve(cwd, configuredDir);
}

function normalizeSetupSelectors(setups: string[] = []): string[] {
  return setups
    .flatMap(setup => setup.split(','))
    .map(setup => setup.trim())
    .filter(Boolean);
}

function detectSetupDirs(rootDir: string, driver: MetaDriver): string[] {
  const marker = SETUP_MARKERS[driver];
  const foundDirs: string[] = [];

  if (!fs.existsSync(rootDir)) {
    return foundDirs;
  }

  const walk = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    if (entries.some(entry => entry.isFile() && entry.name === marker)) {
      foundDirs.push(currentDir);
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (entry.name === '.terraform' || entry.name === '.terragrunt-cache' || entry.name === 'node_modules') {
        continue;
      }

      walk(path.join(currentDir, entry.name));
    }
  };

  walk(rootDir);
  return foundDirs.sort();
}

function resolveSetupDirs(rootDir: string, setupDirs: string[], selectors: string[]): string[] {
  const normalizedSelectors = normalizeSetupSelectors(selectors);

  if (normalizedSelectors.length === 0) {
    return setupDirs;
  }

  const relativeDirMap = new Map<string, string>();
  const basenameMap = new Map<string, string[]>();

  for (const setupDir of setupDirs) {
    const relativeDir = path.relative(rootDir, setupDir);
    relativeDirMap.set(relativeDir, setupDir);

    const basename = path.basename(setupDir);
    basenameMap.set(basename, [...(basenameMap.get(basename) || []), setupDir]);
  }

  const selected = new Set<string>();

  for (const selector of normalizedSelectors) {
    const exactMatch = relativeDirMap.get(selector);
    if (exactMatch) {
      selected.add(exactMatch);
      continue;
    }

    const basenameMatches = basenameMap.get(selector) || [];
    if (basenameMatches.length > 1) {
      throw new Error(`Ambiguous setup selector "${selector}". Use an exact relative path under ${rootDir}.`);
    }

    if (basenameMatches.length === 1) {
      selected.add(basenameMatches[0]);
      continue;
    }

    throw new Error(`No setup matched selector "${selector}" under ${rootDir}.`);
  }

  return [...selected].sort();
}

function resolveRequestedSetupDirs(config: MetaConfig, cwd: string, overrideDir: string | undefined, selectors: string[]): {
  driver: MetaDriver;
  setupDirs: string[];
  targetDir: string;
} {
  const driver = getDriver(config);
  const targetDir = getTargetDir(config, cwd, overrideDir);
  const normalizedSelectors = normalizeSetupSelectors(selectors);

  if (normalizedSelectors.length === 0) {
    return {
      driver,
      setupDirs: [],
      targetDir,
    };
  }

  const detectedSetupDirs = detectSetupDirs(targetDir, driver);

  return {
    driver,
    setupDirs: resolveSetupDirs(targetDir, detectedSetupDirs, normalizedSelectors),
    targetDir,
  };
}

function getToolInstallHints(tool: string, platform = process.platform): string[] {
  const macosHints: Record<string, string[]> = {
    terraform: ['brew tap hashicorp/tap', 'brew install hashicorp/tap/terraform'],
    terragrunt: ['brew install terragrunt'],
    terramate: ['brew install terramate-io/tap/terramate'],
  };

  const linuxHints: Record<string, string[]> = {
    terraform: ['curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -', 'sudo apt-get update && sudo apt-get install terraform'],
    terragrunt: ['sudo wget -O /usr/local/bin/terragrunt https://github.com/gruntwork-io/terragrunt/releases/latest/download/terragrunt_linux_amd64', 'sudo chmod +x /usr/local/bin/terragrunt'],
    terramate: ['curl -fsSL https://github.com/terramate-io/terramate/releases/latest/download/terramate-linux-amd64.tar.gz | sudo tar -xz -C /usr/local/bin terramate'],
  };

  if (platform === 'darwin') {
    return macosHints[tool] || [];
  }

  return linuxHints[tool] || [];
}

function isToolAvailable(tool: string): Promise<boolean> {
  return new Promise(resolve => {
    const child = spawn(tool, ['--version'], { stdio: 'ignore' });

    child.on('error', error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        resolve(false);
        return;
      }

      resolve(false);
    });

    child.on('close', code => {
      resolve(code === 0 || code === 1);
    });
  });
}

function formatMissingToolMessage(tool: string, platform = process.platform): string {
  const hints = getToolInstallHints(tool, platform);
  const osName = platform === 'darwin' ? 'macOS' : 'Linux';

  return [
    `Required tool "${tool}" is not installed or not available on PATH.`,
    `${osName} quick install:`,
    ...hints.map(hint => `  ${hint}`),
  ].join('\n');
}

const TERRAMATE_DISABLED_SAFEGUARDS = 'git-untracked,git-uncommitted,git-out-of-sync';

function getTerramateInitArgs(runTarget: string): string[] {
  return [
    '-C',
    runTarget,
    'run',
    '--',
    'terraform',
    'init',
  ];
}

function getTerramateDefaultArgs(action: DriverAction): string[] {
  const args = ['--enable-sharing'];

  if (action !== 'destroy') {
    args.push('--mock-on-fail');
  }

  args.push(`--disable-safeguards=${TERRAMATE_DISABLED_SAFEGUARDS}`);

  if (action === 'destroy') {
    args.push('--reverse');
  }

  return args;
}

function errorNeedsInitRetry(output: string): boolean {
  const patterns = [
    /run ["']?terraform init["']?/i,
    /please run ["']?terraform init["']?/i,
    /module not installed/i,
    /backend initialization required/i,
    /initialization required/i,
    /inconsistent dependency lock file/i,
    /provider requirements cannot be satisfied/i,
  ];

  return patterns.some(pattern => pattern.test(output));
}

function shellQuote(arg: string): string {
  if (/^[\w%+,./:=@-]+$/.test(arg)) {
    return arg;
  }

  return `'${arg.replaceAll('\'', `'\\''`)}'`;
}

function formatCommandInvocation(command: CommandInvocation): string {
  const invocation = [command.binary, ...command.args.map(shellQuote)].join(' ');

  if (command.cwd) {
    return `(cd ${shellQuote(command.cwd)} && ${invocation})`;
  }

  return invocation;
}

const TERRAFORM_CLOUD_UNSUPPORTED_ACTIONS = new Set<DriverAction>(['plan', 'apply', 'destroy']);

function isTerraformCloudUnsupportedAction(action: DriverAction, config: MetaConfig): boolean {
  return getDriver(config) === 'terraform-cloud' && TERRAFORM_CLOUD_UNSUPPORTED_ACTIONS.has(action);
}

function warnTerraformCloudUnsupportedAction(action: DriverAction, config: MetaConfig): void {
  if (!isTerraformCloudUnsupportedAction(action, config)) {
    return;
  }

  console.log(chalk.yellow([
    '⚠ Warning: The terraform-cloud driver does not properly support this command.',
    `  "meta ${action}" may not work as expected because runs are executed via Terraform Cloud.`,
    '  For manual plan, apply, or destroy runs, use the Terraform Cloud UI instead.',
  ].join('\n')));
}

function buildExecutionPlan(input: {
  action: DriverAction;
  config: MetaConfig;
  cwd: string;
  dir?: string;
  setupDirs?: string[];
  extraArgs?: string[];
}): ExecutionPlan {
  const {
    action,
    config,
    cwd,
    dir,
    extraArgs = [],
    setupDirs = [],
  } = input;

  const driver = getDriver(config);
  const targetDir = getTargetDir(config, cwd, dir);

  if (driver === 'terramate') {
    const detectedSetupDirs = detectSetupDirs(targetDir, driver);
    const runTargets = setupDirs.length > 0
      ? setupDirs
      : detectedSetupDirs.length > 0
        ? detectedSetupDirs
        : [targetDir];
    const commands: CommandInvocation[] = [];

    if (action === 'validate') {
      commands.push({
        binary: 'terramate',
        args: ['-C', targetDir, 'generate'],
      });

      for (const runTarget of runTargets) {
        commands.push({
          binary: 'terramate',
          args: getTerramateInitArgs(runTarget),
        });
        commands.push({
          binary: 'terramate',
          args: [
            '-C',
            runTarget,
            'run',
            ...getTerramateDefaultArgs('validate'),
            '--',
            'terraform',
            'validate',
            ...extraArgs,
          ],
        });
        commands.push({
          binary: 'terramate',
          args: getTerramateInitArgs(runTarget),
        });
      }
    } else {
      for (const runTarget of runTargets) {
        commands.push({
          binary: 'terramate',
          args: [
            '-C',
            runTarget,
            'run',
            ...getTerramateDefaultArgs(action),
            '--',
            'terraform',
            action,
            ...extraArgs,
          ],
        });
        commands.push({
          binary: 'terramate',
          args: getTerramateInitArgs(runTarget),
        });
      }
    }

    return {
      commands,
      requiredTools: ['terramate', 'terraform'],
      targetDir,
    };
  }

  if (driver === 'terragrunt') {
    const commands: CommandInvocation[] = [];

    if (setupDirs.length === 0) {
      if (action === 'validate') {
        commands.push({
          binary: 'terragrunt',
          args: ['--working-dir', targetDir, 'run', '--all', '--', 'validate', ...extraArgs],
        }, {
          binary: 'terragrunt',
          args: ['--working-dir', targetDir, 'run', '--all', '--', 'init', '-backend=false'],
        });
      } else {
        const args = ['--working-dir', targetDir, 'run', '--all'];
        if (action === 'apply' || action === 'destroy') {
          args.push('--no-auto-approve');
        }

        args.push('--', action, ...extraArgs);
        commands.push({
          binary: 'terragrunt',
          args,
        }, {
          binary: 'terragrunt',
          args: ['--working-dir', targetDir, 'run', '--all', '--', 'init'],
        });
      }
    } else {
      for (const setupDir of setupDirs) {
        if (action === 'validate') {
          commands.push({
            binary: 'terragrunt',
            args: ['--working-dir', setupDir, 'validate', ...extraArgs],
          }, {
            binary: 'terragrunt',
            args: ['--working-dir', setupDir, 'init', '-backend=false'],
          });
        } else {
          commands.push({
            binary: 'terragrunt',
            args: ['--working-dir', setupDir, action, ...extraArgs],
          }, {
            binary: 'terragrunt',
            args: ['--working-dir', setupDir, 'init'],
          });
        }
      }
    }

    return {
      commands,
      requiredTools: ['terragrunt'],
      targetDir,
    };
  }

  const terraformSetupDirs = setupDirs.length > 0 ? setupDirs : detectSetupDirs(targetDir, 'terraform-cloud');
  const commands: CommandInvocation[] = [];

  if (terraformSetupDirs.length === 0) {
    throw new Error(`No Terraform setup directories were found under ${targetDir}.`);
  }

  for (const setupDir of terraformSetupDirs) {
    commands.push({
      binary: 'terraform',
      args: [action === 'validate' ? 'validate' : action, ...extraArgs],
      cwd: setupDir,
    }, {
      binary: 'terraform',
      args: action === 'validate' ? ['init', '-backend=false'] : ['init'],
      cwd: setupDir,
    });
  }

  return {
    commands,
    requiredTools: ['terraform'],
    targetDir,
  };
}

function runCommand(command: CommandInvocation): Promise<CommandResult> {
  console.log(chalk.cyan('→ Running:'), formatCommandInvocation(command));

  return new Promise((resolve, reject) => {
    const child = spawn(command.binary, command.args, {
      cwd: command.cwd,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let output = '';

    child.stdout.on('data', chunk => {
      const data = chunk.toString();
      output += data;
      process.stdout.write(data);
    });

    child.stderr.on('data', chunk => {
      const data = chunk.toString();
      output += data;
      process.stderr.write(data);
    });

    child.on('error', reject);
    child.on('close', code => {
      resolve({ code, output });
    });
  });
}

async function executePlan(plan: ExecutionPlan): Promise<void> {
  for (const tool of plan.requiredTools) {
    const available = await isToolAvailable(tool);
    if (!available) {
      throw new Error(formatMissingToolMessage(tool));
    }
  }

  for (let index = 0; index < plan.commands.length; index += 2) {
    const primaryCommand = plan.commands[index];
    const initCommand = plan.commands[index + 1];

    const result = await runCommand(primaryCommand);
    if (result.code === 0) {
      continue;
    }

    if (!initCommand || !errorNeedsInitRetry(result.output)) {
      throw new Error(`${primaryCommand.binary} ${primaryCommand.args.join(' ')} failed with exit code ${result.code}`);
    }

    const initResult = await runCommand(initCommand);
    if (initResult.code !== 0) {
      throw new Error(`${initCommand.binary} ${initCommand.args.join(' ')} failed with exit code ${initResult.code}`);
    }

    const retryResult = await runCommand(primaryCommand);
    if (retryResult.code !== 0) {
      throw new Error(`${primaryCommand.binary} ${primaryCommand.args.join(' ')} failed with exit code ${retryResult.code}`);
    }
  }
}

export {
  buildExecutionPlan,
  detectSetupDirs,
  DRIVER_DEFAULT_DIRS,
  errorNeedsInitRetry,
  executePlan,
  formatCommandInvocation,
  formatMissingToolMessage,
  getTargetDir,
  isTerraformCloudUnsupportedAction,
  normalizeSetupSelectors,
  resolveRequestedSetupDirs,
  resolveSetupDirs,
  warnTerraformCloudUnsupportedAction,
};
