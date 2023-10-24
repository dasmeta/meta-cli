import { Args, Command } from '@oclif/core';
import { getCloudProvider } from '../utils';

export default class Cluster extends Command {
  static description = 'describe the command here'

  static examples = [
    '<%= config.bin %> <%= command.id %> clusterName',
  ]

  static flags = {}

  static strict = false;

  static args = {
    name: Args.string({
      description: 'client name to connect',
      required: true,
    })
  }

  static autocompleteArgs = [
    { arg: 'name', cmd: 'meta client cluster-list' },
  ];
 
  public async run(): Promise<void> {
    const {args} = await this.parse(Cluster);

    getCloudProvider(process.env.META_CLIENT_PROVIDER).updateKubeConfig(args.name, process.env.META_CLIENT_REGION, process.env.META_CLIENT_NAME);
  }
}
