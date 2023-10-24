import {Args, Command} from '@oclif/core'
import { uniq } from 'lodash';
import { Client, getClients } from '../../utils';

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

    const clients = getClients() as Client[];

    if(args.client) {
      const clientsFound = clients.filter(item => item.name === args.client);
      this.log(uniq(clientsFound.map(item => item.alias)).join('\n'));
    }
  }
}
