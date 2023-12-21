import {Command} from '@oclif/core';
import chalk from 'chalk';
import BackendClient from '../BackendClient';
import { getProvider } from '../utils';
import { PROVIDER, UNKNOWN_MODULE } from '../types';

export default class Scan extends Command {
  static description = 'generates metacloud.yaml and _metacloud.tf files and openes new shell with generated environment variables';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --force',
  ]

  static flags = {}

  static args = {}

  public async run(): Promise<void> {

    if(!process.env.META_CLIENT_NAME) {
      this.log(chalk.red(`No active client found. Please run "${this.config.bin} exec" first`));
      return;
    }

    const scannedComponents = await getProvider(process.env.META_CLIENT_PROVIDER as PROVIDER).scan();

    const client = new BackendClient();

    const { data: accountsData } = await client.get('accounts', {
      filters: {
        accountId: {
          $eq: process.env.META_ACCOUNT_ID
        }
      },
      populate: '*' 
    });

    const account = accountsData.data[0];
    const accountId = account.id;
    const clientId = account.attributes.client.data.id;
    const cloudId = account.attributes.cloud.data.id;
    const clientName = account.attributes.client.data.attributes.name;
    const defaultProjectName = `${clientName} // Project created by scan`;

    const { data: projectsData } = await client.get('projects', {
      filters: {
        client: {
          id: {
            $eq: clientId
          }
        },
        name: {
          $eq: defaultProjectName
        }
      },
      populate: '*' 
    });

    let projectId;
    
    if(!projectsData.data.length) {
      const { data: createdData } = await client.post('projects', {
        data: {
          name: defaultProjectName,
          client: clientId
        }
      });

      projectId = createdData.data.id;
    } else {
      projectId = projectsData.data[0].id;
    }

    const { data: componentsData } = await client.get('components', {
      filters: {
        account: {
          id: {
            $eq: accountId
          }
        },
      },
      pagination: {
        page: 1,
        pageSize: 1000
      },
      populate: '*' 
    });

    const viewData = {
      "position": {
        "x": 0,
        "y": 0
      },
      "connectionType": "default",
      "componentViewType": "custom"
    }

    const existingServices = componentsData.data.reduce((acc:{[key: string]: any}, item: any) => {
      acc[item.attributes.identifier] = item.id;
      return acc;
    }, {});

    // create kubernetes services
    let iterator = 0;
    for(const component of scannedComponents) {
      if(!existingServices[component.identifier]) {

        await client.post('components', {
          data: {
            name: component.name,
            project: projectId,
            identifier: component.identifier,
            cloud: cloudId,
            account: accountId,
            module: component.type,
            viewDetails: {
              ...viewData,
              position: {
                x: 0,
                y: iterator * 200
              }
            }
          }
        });
        iterator++
      }
      delete existingServices[component.identifier];
    }

    for(const key in existingServices) {
      await client.delete('components', existingServices[key]);
    }
  }
}