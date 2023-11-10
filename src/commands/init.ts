import {Command, Flags, ux} from '@oclif/core';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as chalk from 'chalk';
import * as inquirer from 'inquirer';

import { getCloudProvider, generateMetaCloudConfig, getMetaCloudConfig, MetaConfig, generateMetaCloudTF } from '../utils';
import { GIT_PROVIDER, PROVIDER } from '../types';
import OPClient from '../OPClient';

export default class Init extends Command {
  static description = 'generates metacloud.yaml and _metacloud.tf files and openes new shell with generated environment variables';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --force',
  ]

  static flags = {
    'force': Flags.boolean({description: 'Force (regenerates config)', char: 'f'}),
  }

  static args = {}

  public async run(): Promise<void> {

    const {flags} = await this.parse(Init)

    let tfCloudOrg = '';
    let tfCloudWorkspace = '';
    let gitProvider = GIT_PROVIDER.GITHUB;
    let gitOrg = '';
    let gitRepo = '';
    let tfAutoApply;
    let yamlDir;
    let rootDir;
    let targetDir;
    let handlerVersion;

    if(!process.env.META_CLIENT_NAME) {
      this.log(chalk.red(`No active client found. Please run "${this.config.bin} exec" first`));
      return;
    }

    if(fs.existsSync('metacloud.yaml') && !flags['force']) {
      this.log('metacloud.yaml found.');

      const yamlConfig = getMetaCloudConfig() as MetaConfig;
      
      tfCloudOrg = yamlConfig.tfCloudOrg;
      tfCloudWorkspace = yamlConfig.tfCloudWorkspace;
      gitProvider = yamlConfig.gitProvider;
      gitOrg = yamlConfig.gitOrg;
      gitRepo = yamlConfig.gitRepo;
      tfAutoApply = yamlConfig.tfAutoApply;
      yamlDir = yamlConfig.yamlDir;
      rootDir = yamlConfig.rootDir;
      targetDir = yamlConfig.targetDir;
      handlerVersion = yamlConfig.handlerVersion;
      
    } else {
      tfCloudOrg = await ux.prompt('Terraform cloud organisation');
      tfCloudWorkspace = await ux.prompt('Terraform cloud workspace', { default: `infrastructure` });
      const provider = await inquirer.prompt([{
          name: 'provider',
          message: 'Git Provider',
          type: 'list',
          choices: [{ name: 'github' }, { name: 'gitlab' }, { name: 'bitbucket' }]
      }]);
      gitProvider = provider['provider'];
      gitOrg = await ux.prompt('Git organisation');
      gitRepo = await ux.prompt('Git repository', { default: 'infrastructure' });

      generateMetaCloudConfig({
        tfCloudOrg,
        tfCloudWorkspace,
        gitProvider,
        gitOrg,
        gitRepo
      });
    }

    const env = getCloudProvider(PROVIDER.AWS).getEnv();
    const { tfToken, gitToken } = await new OPClient().getVariables();

    generateMetaCloudTF({
      tfCloudOrg,
      tfCloudWorkspace,
      gitProvider,
      gitOrg,
      gitRepo,
      tfAutoApply,
      yamlDir,
      rootDir,
      targetDir,
      handlerVersion
    })

    let shell = spawn(process.env.SHELL as string, {
      env: {
          ...process.env,
          ...env,
          TF_TOKEN: tfToken,
          TFE_TOKEN: tfToken,
          TF_TOKEN_app_terraform_io: tfToken,
          TF_VAR_tfc_token: tfToken,
          TF_VAR_token: tfToken,
          TF_VAR_git_token: gitToken,
          TF_VAR_access_key_id: env.AWS_ACCESS_KEY_ID,
          TF_VAR_secret_access_key: env.AWS_SECRET_ACCESS_KEY,
          TF_VAR_default_region: env.AWS_REGION,
          TF_VAR_tfc_org: tfCloudOrg,
          TF_VAR_tfc_workspace: tfCloudWorkspace,
          TF_VAR_git_provider: gitProvider,
          TF_VAR_git_org: gitOrg,
          TF_VAR_git_repo: gitRepo,
      },
      shell: true,
      stdio: 'inherit',
    });

    shell.on('exit', (code) => {
      console.log(`Child shell exited with code ${code}`);
  });
  }
}