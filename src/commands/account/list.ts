import { Command } from '@oclif/core'
import { uniq } from 'lodash';
import { getAccounts } from '../../utils';
import { Account } from '../../types';

export default class List extends Command {

  static args = {}

  static description = ''

  static hidden = true;

  static examples = []

  async run(): Promise<void> {
    const accounts = getAccounts() as Account[];
    
    const uniqueAccounts = uniq(accounts.map(item => item.name));

    uniqueAccounts.forEach(item => {
      this.log(`${item}`)
    });
  }
}
