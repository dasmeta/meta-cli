import {Command, ux} from '@oclif/core'
import * as os from 'os';
import * as fs from 'fs';
import * as chalk from 'chalk';
import { setConfig } from '../utils';

export default class Configure extends Command {
  static description = 'describe the command here'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {}

  static args = {}

  public async run(): Promise<void> {

    const apiKey = await ux.prompt('Backend api key');

    const homeDir = os.homedir();
    const metaDir = `${homeDir}/.meta`;

    if(!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir)
    }

    if(apiKey) {

      setConfig({
        apiKey
      })
      
      this.log(chalk.green('Successfully configured'));
    }
  }
}
