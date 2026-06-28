import { Command } from '@oclif/core';

import { collectTerraformPassthroughArgs, runTerraformWorkspace } from '../terraform-workspace';

export default class Tfp extends Command {
  static summary = 'Terraform plan for the current workspace';

  static description = 'run terraform plan in the current directory when it contains _metacloud.tf or other Terraform root files (*.tf)';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> -target=module.example',
    '<%= config.bin %> <%= command.id %> -- -lock-timeout=5m',
  ];

  static strict = false;

  public async run(): Promise<void> {
    await runTerraformWorkspace({
      action: 'plan',
      extraArgs: collectTerraformPassthroughArgs(this.argv),
    });
  }
}
