import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';

import {
  formatSetupLinkSummary,
  formatSetupsLabel,
  resolveSetupDriver,
} from '../setup-display';
import { getMetaCloudConfig } from '../utils';
import { listYamlSetups, resolveYamlDir } from '../yaml-validation';

export default class List extends Command {
  static summary = 'List infrastructure YAML setups';

  static description = 'list setup YAML definitions (same discovery as validate-yaml, without validation)';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --yaml-dir ./infra',
  ];

  static flags = {
    'yaml-dir': Flags.string({ description: 'Directory containing infrastructure YAML (default: yaml_dir from metacloud.yaml or .)' }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const cwd = process.cwd();
    const config = getMetaCloudConfig();
    const yamlDir = resolveYamlDir(cwd, config, flags['yaml-dir']);
    const driver = resolveSetupDriver(config);
    const result = listYamlSetups({ yamlDir });
    const setupPaths = new Set(result.setups.map(item => item.path));

    this.log(chalk.cyan('→ YAML directory:'), yamlDir);
    this.log(chalk.cyan(`→ ${formatSetupsLabel(driver)}:`), result.setups.length.toString());

    for (const setup of result.setups) {
      this.log(`  - ${setup.path}${formatSetupLinkSummary(setup, setupPaths)}`);
    }
  }
}
