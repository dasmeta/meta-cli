import { spawn } from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';

import { BootstrapPlan, BootstrapStep } from './types';

export function formatStepCommand(step: BootstrapStep): string {
  const redacted = new Set(step.redactArgs || []);
  const renderedArgs = step.args.map((arg, index) => (
    redacted.has(index) ? '<redacted>' : arg
  ));

  return [step.command, ...renderedArgs].join(' ');
}

export function formatPlan(plan: BootstrapPlan): string {
  const lines = [
    chalk.cyan(`Backend: ${plan.backend}`),
    plan.summary,
    '',
    chalk.bold('Planned actions:'),
  ];

  plan.steps.forEach((step, index) => {
    const label = chalk.gray(`[${step.action}]`);
    lines.push(`  ${index + 1}. ${label} ${step.description}`);
    lines.push(`     ${chalk.dim(formatStepCommand(step))}`);
  });

  return lines.join('\n');
}

export async function confirmPlan(skipConfirm: boolean): Promise<boolean> {
  if (skipConfirm) {
    return true;
  }

  const answer = await inquirer.prompt([{
    name: 'confirmed',
    type: 'confirm',
    message: 'Proceed with backend provisioning?',
    default: false,
  }]);

  return Boolean(answer.confirmed);
}

export async function runStep(
  step: BootstrapStep,
  log: (message: string) => void,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  log(`${chalk.cyan(`→ [${step.action}]`)} ${step.description}`);
  log(chalk.dim(formatStepCommand(step)));

  return new Promise((resolve, reject) => {
    const child = spawn(step.command, step.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

export async function executePlan(
  plan: BootstrapPlan,
  log: (message: string, ...args: unknown[]) => void,
  options: { skipConfirm?: boolean } = {},
): Promise<void> {
  log(formatPlan(plan));
  log('');

  const confirmed = await confirmPlan(Boolean(options.skipConfirm));
  if (!confirmed) {
    log(chalk.yellow('Aborted. No backend resources were created.'));
    return;
  }

  log(chalk.green('Creating backend resources...'));
  log('');

  for (const step of plan.steps) {
    const result = await runStep(step, (message, ...args) => log(message, ...args));

    if (result.exitCode !== 0) {
      throw new Error(`Step failed (${step.action}): ${step.description}`);
    }
  }

  log('');
  log(chalk.green('Backend provisioning completed.'));
}
