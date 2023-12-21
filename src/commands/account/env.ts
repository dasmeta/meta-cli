import {Args, Command} from '@oclif/core'
import { uniq } from 'lodash';
import { getAccounts } from '../../utils';
import { Account } from '../../types';

export default class Env extends Command {

  static hidden = true;

  static args = {
    client: Args.string({
      required: true,
    }),
  }

  static description = ''

  static examples = []

  static flags = {}

  async run(): Promise<void> {
    const {args} = await this.parse(Env)

    const accounts = getAccounts() as Account[];

    if(args.client) {
      const accountsFound = accounts.filter(item => item.name === args.client);
      this.log(uniq(accountsFound.map(item => item.alias)).join('\n'));
    }
  }
}
