import {Command, ux} from '@oclif/core';
import chalk from 'chalk';
import { lowerCase } from 'lodash';
import BackendClient from '../BackendClient';
import { setAccounts, getProvider } from '../utils';
import { Account, PROVIDER, PROVIDERMAP } from '../types';

export default class Refresh extends Command {
  static description = 'describe the command here'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {}

  static args = {}

  public async run(): Promise<void> {

    const client = new BackendClient();

    const { data } = await client.get('accounts', { populate: '*' });

    const accounts: Account[] = [];

    for(const item of data.data) {

      if(!item.attributes.provider?.data?.id) {
        continue;
      }

      if(!PROVIDERMAP[item.attributes.provider?.data?.id as number]) {
        this.log(chalk.gray(`Provider ${item.attributes.provider?.data?.attributes?.name} is not being supported. Skipping`));
        continue;
      }

      const account = {
        name: lowerCase(item.attributes.client?.data?.attributes?.name),
        alias: item.attributes.alias,
        accountId: item.attributes.accountId,
        provider: PROVIDERMAP[item.attributes.provider?.data?.id],
        ...(item.attributes.config || {}),
      }

      if(item.attributes.parent_account?.data) {

        const { data } = await client.get(`accounts/${item.attributes.parent_account?.data.id}`, { populate: '*' });

        const parent = data.data;
        account.parentAccount = {
          name: lowerCase(parent.attributes.client?.data?.attributes?.name),
          alias: parent.attributes.alias,
          accountId: parent.attributes.accountId,
          provider: PROVIDERMAP[parent.attributes.provider?.data?.id],
          parentAccount: null,
          ...(parent.attributes.config || {}),
        }
      }
      
      getProvider(PROVIDERMAP[item.attributes.provider?.data?.id] as PROVIDER).generateConfig(account);
      accounts.push(account);
    };

    setAccounts(accounts);
  }
}