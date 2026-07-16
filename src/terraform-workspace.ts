import { spawn } from 'node:child_process';

import chalk from 'chalk';

import { formatCommandInvocation } from './driver-runtime';
import {
  assertTerraformWorkspace,
  
} from './workspace-context';

export type TerraformWorkspaceAction = 'init' | 'plan' | 'apply' | 'destroy';

function collectTerraformPassthroughArgs(argv: string[]): string[] {
  const separatorIndex = argv.indexOf('--');

  if (separatorIndex >= 0) {
    return argv.slice(separatorIndex + 1);
  }

  return argv;
}

function isTerraformAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const child = spawn('terraform', ['version'], { stdio: 'ignore' });

    child.on('error', () => {
      resolve(false);
    });

    child.on('close', code => {
      resolve(code === 0);
    });
  });
}

async function runTerraformCommand(cwd: string, args: string[]): Promise<void> {
  const command = {
    binary: 'terraform',
    args,
    cwd,
  };

  console.log(chalk.cyan('→ Running:'), formatCommandInvocation(command));

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.binary, command.args, {
      cwd: command.cwd,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`terraform ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

async function runTerraformWorkspace(input: {
  action: TerraformWorkspaceAction;
  cwd?: string;
  extraArgs?: string[];
}): Promise<void> {
  const cwd = input.cwd || process.cwd();
  const extraArgs = input.extraArgs || [];

  assertTerraformWorkspace(cwd);

  const available = await isTerraformAvailable();
  if (!available) {
    throw new Error('Required tool "terraform" is not installed or not available on PATH.');
  }

  await runTerraformCommand(cwd, [input.action, ...extraArgs]);
}

export {
  
  
  collectTerraformPassthroughArgs,
  runTerraformWorkspace,
};

export {META_CLOUD_TF, assertTerraformWorkspace} from './workspace-context';