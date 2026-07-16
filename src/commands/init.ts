import {Command, Flags, ux} from '@oclif/core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import chalk from 'chalk';
import inquirer from 'inquirer';

import {
  getProvider,
  generateMetaCloudConfig,
  getMetaCloudConfig,
  MetaConfig,
  generateMetaCloudTF,
  MetaDriver,
  TerraformBackendConfig,
} from '../utils';
import { setupIdeYamlSchemas } from '../ide-schemas';
import { GIT_PROVIDER, PROVIDER } from '../types';
import OPClient from '../OPClient';

export default class Init extends Command {
  static summary = 'Generate metacloud.yaml and _metacloud.tf, then open a configured shell';

  static description = 'generates metacloud.yaml and _metacloud.tf files and openes new shell with generated environment variables';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --force',
    '<%= config.bin %> <%= command.id %> --driver terramate',
  ]

  static flags = {
    'force': Flags.boolean({description: 'Force (regenerates config)', char: 'f'}),
    'driver': Flags.string({
      description: 'Driver to generate on first run or when used with --force',
      options: ['terraform-cloud', 'terramate', 'terragrunt'],
    }),
    'skip-ide-schemas': Flags.boolean({
      description: 'Skip VS Code/Cursor YAML schema setup in .vscode/settings.json',
      default: false,
    }),
    'ide-schemas': Flags.string({
      description: 'How to reference MetaCloud JSON schemas (remote = unpkg URL, local = copy bundled files)',
      options: ['remote', 'local'],
    }),
  }

  static args = {}

  private async promptGitProvider(): Promise<GIT_PROVIDER> {
    const provider = await inquirer.prompt([{
      name: 'provider',
      message: 'Git Provider',
      type: 'list',
      choices: [{ name: 'github' }, { name: 'gitlab' }, { name: 'bitbucket' }],
    }]);

    return provider.provider as GIT_PROVIDER;
  }

  private async promptTerraformBackend(driver: MetaDriver, defaultRegion?: string): Promise<TerraformBackendConfig> {
    const backend = await inquirer.prompt([{
      name: 'name',
      message: 'Terraform backend type',
      type: 'list',
      choices: [{ name: 's3' }, { name: 'local' }],
      default: 's3',
    }]);

    if (backend.name === 'local') {
      const path = await ux.prompt('Local backend path', {
        default: driver === 'terramate' ? '.terraform-state' : '.terragrunt-state',
      });

      return {
        name: 'local',
        configs: { path },
      };
    }

    const bucket = await ux.prompt('Terraform state bucket');
    const region = await ux.prompt('Terraform state region', { default: defaultRegion || 'eu-central-1' });
    const key = await ux.prompt('Terraform state key prefix', { default: driver === 'terramate' ? 'terramate' : 'terragrunt' });

    return {
      name: 's3',
      configs: {
        bucket,
        region,
        key,
      },
    };
  }

  private async buildNewMetaConfig(driver: MetaDriver): Promise<MetaConfig> {
    const defaultRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

    if (driver === 'terraform-cloud') {
      const gitProvider = await this.promptGitProvider();
      const gitOrg = await ux.prompt('Git organisation');
      const gitRepo = await ux.prompt('Git repository', { default: 'infrastructure' });
      const tfCloudOrg = await ux.prompt('Terraform cloud organisation');
      const tfCloudWorkspace = await ux.prompt('Terraform cloud workspace', { default: 'infrastructure' });

      return {
        driver,
        tfCloudOrg,
        tfCloudWorkspace,
        gitProvider,
        gitOrg,
        gitRepo,
      };
    }

    const terraformBackend = await this.promptTerraformBackend(driver, defaultRegion);

    if (driver === 'terramate') {
      return {
        driver,
        terraformBackend,
        yamlDir: '.',
        targetDir: '_terraform',
        linkingMode: 'terramate_outputs_sharing',
        mockInputsEnabled: true,
      };
    }

    return {
      driver,
      terraformBackend,
      yamlDir: '.',
      targetDir: '_terragrunt',
    };
  }

  private resolveDriver(flags: { force?: boolean; driver?: string }): MetaDriver {
    const existingConfig = fs.existsSync('metacloud.yaml') ? getMetaCloudConfig() as MetaConfig : null;

    if (existingConfig && !flags.force) {
      return (existingConfig.driver || 'terraform-cloud') as MetaDriver;
    }

    return (flags.driver || existingConfig?.driver || 'terraform-cloud') as MetaDriver;
  }

  private logDriver(config: MetaConfig, flags: { force?: boolean; driver?: string }): void {
    const driver = config.driver || 'terraform-cloud';

    this.log(chalk.cyan('→ Driver:'), driver);

    if (fs.existsSync('metacloud.yaml') && !flags.force) {
      this.log(chalk.gray('  Using driver from metacloud.yaml (--driver is not required).'));
      return;
    }

    if (flags.driver) {
      this.log(chalk.gray('  Using --driver flag.'));
      return;
    }

    if (fs.existsSync('metacloud.yaml') && flags.force) {
      this.log(chalk.gray('  Using driver from metacloud.yaml (--force without --driver).'));
      return;
    }

    this.log(chalk.gray('  Using default driver for first-time init.'));
  }

  private canInitWithoutExec(config: MetaConfig | null, flags: { force?: boolean }): boolean {
    return Boolean(
      config
      && !flags.force
      && (config.driver || 'terraform-cloud') !== 'terraform-cloud',
    );
  }

  private configureIdeSchemas(
    config: MetaConfig,
    flags: { 'skip-ide-schemas'?: boolean; 'ide-schemas'?: string },
  ): void {
    const result = setupIdeYamlSchemas(process.cwd(), (config.driver || 'terraform-cloud') as MetaDriver, {
      skip: flags['skip-ide-schemas'],
      mode: flags['ide-schemas'] as 'remote' | 'local' | undefined,
    });

    if (!result) {
      return;
    }

    const schemaSource = result.mode === 'remote'
      ? `unpkg @${result.schemaVersion}`
      : 'bundled copy in .vscode/schemas/metacloud';

    this.log(chalk.green('Configured IDE YAML schemas'), chalk.gray(`(${schemaSource})`));
    this.log(chalk.gray(`  ${result.settingsPath}`));
  }

  private regenerateFromExistingConfig(
    config: MetaConfig,
    flags: { force?: boolean; driver?: string; 'skip-ide-schemas'?: boolean; 'ide-schemas'?: string },
  ): void {
    if (flags.driver) {
      this.log(chalk.yellow(`Ignoring --driver ${flags.driver}; metacloud.yaml already defines the driver.`));
    }

    this.log('metacloud.yaml found.');
    this.logDriver(config, flags);
    generateMetaCloudTF(config);
    this.log(chalk.green('Generated _metacloud.tf.'));
    this.configureIdeSchemas(config, flags);
    this.log(chalk.gray(`Run "${this.config.bin} exec <account> <env>" when AWS credentials are required for plan/apply.`));
  }

  public async run(): Promise<void> {

    const {flags} = await this.parse(Init)

    const existingConfig = fs.existsSync('metacloud.yaml') && !flags.force
      ? getMetaCloudConfig() as MetaConfig
      : null;

    if (!process.env.META_CLIENT_NAME) {
      if (this.canInitWithoutExec(existingConfig, flags)) {
        this.regenerateFromExistingConfig(existingConfig as MetaConfig, flags);
        return;
      }

      const driver = existingConfig?.driver || 'terraform-cloud';
      this.log(chalk.red(`No active client found. Please run "${this.config.bin} exec <account> <env>" first.`));
      this.log(chalk.gray(`Driver "${driver}" requires a meta exec session.`));
      return;
    }

    if (flags.driver && fs.existsSync('metacloud.yaml') && !flags.force) {
      this.log(chalk.yellow(`Ignoring --driver ${flags.driver}; metacloud.yaml already defines the driver.`));
    }

    let config: MetaConfig;

    if(existingConfig) {
      config = existingConfig;
      this.log('metacloud.yaml found.');
    } else {
      const driver = this.resolveDriver(flags);
      config = await this.buildNewMetaConfig(driver);
      generateMetaCloudConfig(config);
    }

    this.logDriver(config, flags);

    const env = getProvider(PROVIDER.AWS).getEnv();
    generateMetaCloudTF(config);
    this.configureIdeSchemas(config, flags);

    let tfToken = '';
    let gitToken = '';
    if ((config.driver || 'terraform-cloud') === 'terraform-cloud') {
      ({ tfToken, gitToken } = await new OPClient().getVariables());
    }

    const shellEnv = {
      ...process.env,
      ...env,
      TF_VAR_access_key_id: env.AWS_ACCESS_KEY_ID,
      TF_VAR_secret_access_key: env.AWS_SECRET_ACCESS_KEY,
      TF_VAR_default_region: env.AWS_REGION,
      TF_VAR_region: env.AWS_REGION,
      TF_VAR_session_token: env.AWS_SESSION_TOKEN,
      TF_VAR_security_token: env.AWS_SESSION_TOKEN,
    } as NodeJS.ProcessEnv;

    if ((config.driver || 'terraform-cloud') === 'terraform-cloud') {
      Object.assign(shellEnv, {
        TF_VAR_git_provider: config.gitProvider,
        TF_VAR_git_org: config.gitOrg,
        TF_VAR_git_repo: config.gitRepo,
        TF_TOKEN: tfToken,
        TFE_TOKEN: tfToken,
        TF_TOKEN_app_terraform_io: tfToken,
        TF_VAR_tfc_token: tfToken,
        TF_VAR_token: tfToken,
        TF_VAR_git_token: gitToken,
        TF_VAR_tfc_org: config.tfCloudOrg,
        TF_VAR_tfc_workspace: config.tfCloudWorkspace,
      });
    }

    const shell = spawn(process.env.SHELL as string, {
      env: shellEnv,
      shell: true,
      stdio: 'inherit',
    });

    shell.on('exit', (code) => {
      console.log(`Child shell exited with code ${code}`);
  });
  }
}
