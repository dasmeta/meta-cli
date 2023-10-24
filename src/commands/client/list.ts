import { Command } from '@oclif/core'
import { uniq } from 'lodash';
import { Client, getClients } from '../../utils';

export default class List extends Command {

  static args = {}

  static description = ''

  static hidden = true;

  static examples = []

  async run(): Promise<void> {
    const clients = getClients() as Client[];

    const uniqueClients = uniq(clients.map(item => item.name));

    uniqueClients.forEach(item => {
      this.log(`${item}`)
    })
  }
}
