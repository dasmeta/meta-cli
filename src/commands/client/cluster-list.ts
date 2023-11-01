import { Command } from '@oclif/core'
import { getCloudProvider } from '../../utils';
import { PROVIDER } from '../../types';

export default class ClusterList extends Command {

  static args = {}

  static description = ''

  static hidden = true;

  static examples = []

  async run(): Promise<void> {

    const output = getCloudProvider(process.env.META_CLIENT_PROVIDER as PROVIDER).getClusterList();
    const clusters = output.split('\t');
    clusters.forEach(item => {
      this.log(item);
    })
  }
}
