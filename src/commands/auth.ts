import {Args, Command, Flags, ux} from '@oclif/core';
import * as chalk from 'chalk';
import { lowerCase } from 'lodash';
import BackendClient from '../BackendClient';
import { setClients, getCloudProvider } from '../utils';
import { PROVIDER } from '../types';

export default class Auth extends Command {
  static description = 'describe the command here'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {}

  static args = {}

  public async run(): Promise<void> {

    const username = await ux.prompt('Username')
    const password = await ux.prompt('Password', { type: 'hide' });

    const client = new BackendClient();

    if(username === 'user' && password === 'pass') {
      this.log(chalk.green('Authenticated successfully.'));
      const { data } = await client.get('accounts', { populate: '*' });

      const clientData = data.data.map((item: any) => ({
        name: lowerCase(item.attributes.client?.data?.attributes?.name),
        alias: item.attributes.alias,
        accountId: item.attributes.accountId,
        cloud: item.attributes.cloud?.data?.attributes?.Name,
        defaultRegion: item.attributes.default_region,
        defaultRole: item.attributes.default_role,
        ssoAlias: item.attributes.sso_alias
      }));

      setClients(clientData);

      getCloudProvider(PROVIDER.AWS).generateConfig();


      return;
    }
    this.log(chalk.red('Authentication failed.'));
  }
}