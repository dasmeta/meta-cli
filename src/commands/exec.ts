import { Args, Command } from '@oclif/core';
import chalk from 'chalk';
import { getAccounts, getProvider } from '../utils';
import { Account } from '../types';
import { spawn } from 'child_process';

export default class Exec extends Command {
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
    const {args} = await this.parse(Exec)

    const clients = getAccounts() as Account[];

    if(args.account) {
      const clientsFound = clients.filter(item => item.name === args.account);
      if(!clientsFound.length) {
        this.log(chalk.red('Wrong client \n'));
        return;
      }

      if(args.env) {
        const environmentFound = clientsFound.find(item => `${item.name}-${item.alias}` === `${args.account}-${args.env}`);
        if(!environmentFound) {
          this.log(chalk.red('Wrong environment \n'));
          return;
        }

        let allEnv = {};
        if(environmentFound.parentAccount) {
          const env = getProvider(environmentFound.parentAccount.provider).exec(environmentFound.parentAccount);
          allEnv = {...env};
        }

        const env = getProvider(environmentFound.provider).exec(environmentFound);
        allEnv = { ...allEnv, ...env };

        let shell = spawn(process.env.SHELL as string, [], {
            env: {
                ...process.env,
                ...allEnv,
                META_ACCOUNT_ID: environmentFound.accountId,
                META_CLIENT_PROVIDER: environmentFound.provider,
                META_CLIENT_NAME: `${environmentFound.name}-${environmentFound.alias}`
            },
            stdio: 'inherit'
          });

        shell.on('exit', (code) => {
            console.log(`Child shell exited with code ${code}`);
        });
      }
    }
  }
}
