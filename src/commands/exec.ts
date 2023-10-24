import { Args, Command } from '@oclif/core';
import * as chalk from 'chalk';
import { execSync, spawn } from 'child_process';
import { Client, getClients, getCloudProvider, setClustersList } from '../utils';

export default class Exec extends Command {
  static description = 'describe the command here'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {}

  static strict = false;

  static args = {
    client: Args.string({
      description: 'client name to connect',
      required: true,
    }),
    env: Args.string({
      description: 'environment you want to use',
      required: true,
    })
  }

  static autocompleteArgs = [
    { arg: 'client', cmd: 'meta client list' },
    { arg: 'env', cmd: 'meta client env' }
  ];
 
  public async run(): Promise<void> {
    const {args} = await this.parse(Exec)

    const clients = getClients() as Client[];

    if(args.client) {
      const clientsFound = clients.filter(item => item.name === args.client);
      if(!clientsFound.length) {
        this.log(chalk.red('Wrong client \n'));
        return;
      }

      if(args.env) {
        const environmentFound = clientsFound.find(item => `${item.name}-${item.alias}` === `${args.client}-${args.env}`);
        if(!environmentFound) {
          this.log(chalk.red('Wrong environment \n'));
          return;
        }

        getCloudProvider(environmentFound.cloud).exec(environmentFound);
      }
    }
  }
}
