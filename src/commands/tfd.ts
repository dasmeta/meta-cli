import { Command } from '@oclif/core';

import { collectTerraformPassthroughArgs, runTerraformWorkspace } from '../terraform-workspace';

export default class Tfd extends Command {
  static summary = 'Terraform destroy for the current workspace';

  static description = 'run terraform destroy in the current directory when it contains _metacloud.tf or other Terraform root files (*.tf)';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> -auto-approve',
    '<%= config.bin %> <%= command.id %> -- -auto-approve',
  ];

  static strict = false;

  public async run(): Promise<void> {
    await runTerraformWorkspace({
      action: 'destroy',
      extraArgs: collectTerraformPassthroughArgs(this.argv),
    });
  }
}
