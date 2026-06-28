import { Command } from '@oclif/core';

import {
  DIR_FLAG,
  DRIVER_FLAG,
  SETUP_FLAG,
  parseDriverFlag,
} from '../driver-command-flags';
import {
  buildExecutionPlan,
  executePlan,
  resolveRequestedSetupDirs,
  warnTerraformCloudUnsupportedAction,
} from '../driver-runtime';
import { resolveDriverConfig } from '../workspace-context';

export default class Plan extends Command {
  static summary = 'Plan generated setups via the configured driver';

  static description = 'plan generated infrastructure using the configured driver wrapper';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --setup group-0/module-a,group-2/dns-zone',
    '<%= config.bin %> <%= command.id %> --driver terramate',
    '<%= config.bin %> <%= command.id %> -- --lock-timeout=5m',
  ];

  static flags = {
    dir: DIR_FLAG,
    driver: DRIVER_FLAG,
    setup: SETUP_FLAG,
  };

  static strict = false;

  public async run(): Promise<void> {
    const { flags } = await this.parse(Plan);
    const cwd = process.cwd();
    const config = resolveDriverConfig(cwd, {
      driver: parseDriverFlag(flags.driver),
      dir: flags.dir,
    });

    const passthroughIndex = this.argv.indexOf('--');
    const extraArgs = passthroughIndex >= 0 ? this.argv.slice(passthroughIndex + 1) : [];
    const { setupDirs } = resolveRequestedSetupDirs(config, cwd, flags.dir, flags.setup || []);

    warnTerraformCloudUnsupportedAction('plan', config);

    const plan = buildExecutionPlan({
      action: 'plan',
      config,
      cwd,
      dir: flags.dir,
      extraArgs,
      setupDirs,
    });

    await executePlan(plan);
  }
}
