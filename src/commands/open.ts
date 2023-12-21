import {Args, Command} from '@oclif/core'
import chalk from 'chalk';
import { getAccounts, getProvider } from '../utils';
import { Account } from '../types';

export default class Open extends Command {
  static description = 'describe the command here'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {}

  static strict = false;

  static args = {
    account: Args.string({
      description: 'account name to connect',
      required: true,
    }),
    env: Args.string({
      description: 'environment you want to use',
      required: true,
    })
  }

  static autocompleteArgs = [
    { arg: 'account', cmd: 'meta account list' },
    { arg: 'env', cmd: 'meta account env' }
  ];

  public async run(): Promise<void> {
    const {args} = await this.parse(Open)

    const accounts = getAccounts() as Account[];

    if(args.account) {
      const accountsFound = accounts.filter(item => item.name === args.account);
      if(!accountsFound.length) {
        this.log(chalk.red('Wrong client \n'));
        return;
      }

      if(args.env) {
        const environmentFound = accountsFound.find(item => `${item.name}-${item.alias}` === `${args.account}-${args.env}`);
        if(!environmentFound) {
          this.log(chalk.red('Wrong environment \n'));
          return;
        }

        getProvider(environmentFound.provider).open(environmentFound);
      }
    }
  }
}
