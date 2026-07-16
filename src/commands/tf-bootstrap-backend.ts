import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import path from 'path';

import { bootstrapBackendFromConfig, loadMetaCloudConfigFromDir } from '../backend-bootstrap';
import OPClient from '../OPClient';

export default class TfBootstrapBackend extends Command {
  static summary = 'Create or configure the Terraform backend from metacloud.yaml';

  static description = [
    'Reads metacloud.yaml, shows the provider CLI actions that will run,',
    'waits for confirmation, then creates the backend object:',
    'S3 bucket (AWS CLI), Azure storage account + container (az CLI),',
    'GCS bucket (gcloud CLI), or Terraform Cloud workspace with local execution (API).',
  ].join(' ');

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --dir ./terramate',
    '<%= config.bin %> <%= command.id %> --yes',
  ];

  static flags = {
    dir: Flags.string({
      description: 'Directory containing metacloud.yaml',
      default: process.cwd(),
    }),
    yes: Flags.boolean({
      description: 'Skip confirmation prompt',
      default: false,
    }),
    region: Flags.string({
      description: 'AWS region override (s3 backend)',
    }),
    location: Flags.string({
      description: 'Azure/GCP location override (azurerm, gcs backends)',
    }),
    token: Flags.string({
      description: 'Terraform Cloud API token override',
    }),
    'terraform-version': Flags.string({
      description: 'Terraform version for new Terraform Cloud workspaces',
      default: '1.9.0',
    }),
  };

  static args = {};

  public async run(): Promise<void> {
    const { flags } = await this.parse(TfBootstrapBackend);
    const dir = path.resolve(flags.dir);

    this.log(chalk.cyan('→ Backend bootstrap'));
    this.log(chalk.gray(`  ${dir}/metacloud.yaml`));
    this.log('');

    const config = loadMetaCloudConfigFromDir(dir);
    const driver = config.driver || 'terraform-cloud';

    this.log(chalk.cyan('→ Driver:'), driver);
    if (driver === 'terraform-cloud') {
      this.log(chalk.gray(`  org: ${config.tfCloudOrg}`));
      this.log(chalk.gray(`  workspace: ${config.tfCloudWorkspace}`));
    } else {
      this.log(chalk.gray(`  backend: ${config.terraformBackend?.name}`));
    }
    this.log('');

    let token = flags.token;
    if ((driver === 'terraform-cloud') && !token && process.env.META_CLIENT_NAME) {
      try {
        ({ tfToken: token } = await new OPClient().getVariables());
        this.log(chalk.gray('Using Terraform Cloud token from 1Password.'));
        this.log('');
      } catch {
        this.log(chalk.yellow('Could not load TFC token from 1Password; set TF_TOKEN_app_terraform_io or --token.'));
      }
    }

    await bootstrapBackendFromConfig(config, (message, ...args) => this.log(message, ...args), {
      skipConfirm: flags.yes,
      region: flags.region,
      location: flags.location,
      token,
      terraformVersion: flags['terraform-version'],
    });
  }
}
