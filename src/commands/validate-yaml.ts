import path from 'node:path';

import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';

import { getMetaCloudConfig } from '../utils';
import {
  formatSetupLinkSummary,
  formatSetupsLabel,
  resolveSetupDriver,
} from '../setup-display';
import { resolveYamlDir, validateYamlDirectory } from '../yaml-validation';

export default class ValidateYaml extends Command {
  static summary = 'Validate MetaCloud and infrastructure YAML configuration';

  static description = 'validate infrastructure YAML (metacloud.yaml when present, otherwise workspace YAML in the current or selected directory)';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --yaml-dir ./infra',
    '<%= config.bin %> <%= command.id %> --strict',
  ];

  static flags = {
    'yaml-dir': Flags.string({ description: 'Directory containing infrastructure YAML (default: yaml_dir from metacloud.yaml or .)' }),
    strict: Flags.boolean({ description: 'Treat warnings as errors', default: false }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ValidateYaml);
    const cwd = process.cwd();
    const config = getMetaCloudConfig();
    const yamlDir = resolveYamlDir(cwd, config, flags['yaml-dir']);
    const metacloudPath = config ? path.join(cwd, 'metacloud.yaml') : undefined;

    const result = validateYamlDirectory({
      yamlDir,
      metacloudPath,
      strict: flags.strict,
    });
    const driver = resolveSetupDriver(config);
    const setupPaths = new Set(result.workspaces.map(item => item.path));

    this.log(chalk.cyan('→ YAML directory:'), yamlDir);
    this.log(chalk.cyan(`→ ${formatSetupsLabel(driver)}:`), result.workspaces.length.toString());

    if (result.workspaces.length > 0) {
      for (const workspace of result.workspaces) {
        this.log(`  - ${workspace.path}${formatSetupLinkSummary(workspace, setupPaths)}`);
      }
    }

    if (result.issues.length === 0) {
      this.log('');
      this.log(chalk.green('YAML configuration is valid.'));
      return;
    }

    this.log('');
    for (const issue of result.issues) {
      const label = issue.severity === 'error' ? chalk.red('error') : chalk.yellow('warning');
      this.log(`${label} [${issue.code}] ${issue.file}: ${issue.message}`);
    }

    this.log('');
    if (result.ok) {
      this.log(chalk.yellow('Validation completed with warnings.'));
      return;
    }

    throw new Error('YAML validation failed.');
  }
}
