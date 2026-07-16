import {Command} from '@oclif/core';

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
} from '../driver-runtime';
import { resolveDriverConfig } from '../workspace-context';

export default class Validate extends Command {
  static summary = 'Validate generated setups via the configured driver';

  static description = 'validate generated infrastructure using the configured driver wrapper';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --setup group-0/module-a',
    '<%= config.bin %> <%= command.id %> --driver terramate',
    '<%= config.bin %> <%= command.id %> -- --no-color',
  ];

  static flags = {
    dir: DIR_FLAG,
    driver: DRIVER_FLAG,
    setup: SETUP_FLAG,
  };

  static strict = false;

  public async run(): Promise<void> {
    const { flags } = await this.parse(Validate);
    const cwd = process.cwd();
    const config = resolveDriverConfig(cwd, {
      driver: parseDriverFlag(flags.driver),
      dir: flags.dir,
    });

    const passthroughIndex = this.argv.indexOf('--');
    const extraArgs = passthroughIndex >= 0 ? this.argv.slice(passthroughIndex + 1) : [];
    const { setupDirs } = resolveRequestedSetupDirs(config, cwd, flags.dir, flags.setup || []);

    const plan = buildExecutionPlan({
      action: 'validate',
      config,
      cwd,
      dir: flags.dir,
      extraArgs,
      setupDirs,
    });

    await executePlan(plan);
  }
}
