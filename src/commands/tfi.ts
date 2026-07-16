import { Command } from '@oclif/core';

import { collectTerraformPassthroughArgs, runTerraformWorkspace } from '../terraform-workspace';

export default class Tfi extends Command {
  static summary = 'Terraform init for the current workspace';

  static description = 'run terraform init in the current directory when it contains _metacloud.tf or other Terraform root files (*.tf)';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> -upgrade',
    '<%= config.bin %> <%= command.id %> -- -upgrade',
  ];

  static strict = false;

  public async run(): Promise<void> {
    await runTerraformWorkspace({
      action: 'init',
      extraArgs: collectTerraformPassthroughArgs(this.argv),
    });
  }
}
