import {Command} from '@oclif/core';
import chalk from 'chalk';
import BackendClient from '../BackendClient';
import { getCloudProvider } from '../utils';
import { DB_ENGINE, PROVIDER, UNKNOWN_MODULE } from '../types';

const dbEngineModuleMapping = {
  [DB_ENGINE.POSTGRES]: UNKNOWN_MODULE.POSTGRES,
  [DB_ENGINE.MARIADB]: UNKNOWN_MODULE.MARIADB
}

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

    const clusterData = await getCloudProvider(PROVIDER.AWS).scanClusters();
    const dbData = await getCloudProvider(PROVIDER.AWS).scanDatabases();
    const bucketData = await getCloudProvider(PROVIDER.AWS).scanBuckets();

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

    const { data: projectsData } = await client.get('projects', {
      filters: {
        client: {
          id: {
            $eq: clientId
          }
        },
        name: {
          $eq: 'Project created by scan'
        }
      },
      populate: '*' 
    });

    let projectId;
    
    if(!projectsData.data.length) {
      const { data: createdData } = await client.post('projects', {
        data: {
          name: 'Project created by scan',
          client: clientId
        }
      });

      projectId = createdData.data.id;
    } else {
      projectId = projectsData.data[0].id;
    }

    const { data: componentsData } = await client.get('components', {
      filters: {
        project: {
          id: {
            $eq: projectId
          }
        },
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
    for(const service of clusterData.services) {
      if(!existingServices[service.identifier]) {

        await client.post('components', {
          data: {
            name: service.name,
            project: projectId,
            identifier: service.identifier,
            cloud: cloudId,
            account: accountId,
            module: UNKNOWN_MODULE.APPLICATION,
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
      delete existingServices[service.identifier];
    }

    // create buckets
    iterator = 0;
    for(const bucket of bucketData) {
      if(!existingServices[bucket.name]) {
        await client.post('components', {
          data: {
            name: bucket.name,
            project: projectId,
            identifier: bucket.name,
            cloud: cloudId,
            account: accountId,
            module: UNKNOWN_MODULE.S3,
            viewDetails: {
              ...viewData,
              position: {
                x: 450,
                y: iterator * 200
              }
            }
          }
        });
        iterator++;
      }
      delete existingServices[bucket.name];
    }

    // create databases
    iterator = 0;
    for(const instance of dbData) {
      if(!existingServices[instance.identifier]) {
        await client.post('components', {
          data: {
            name: instance.name,
            project: projectId,
            identifier: instance.identifier,
            account: accountId,
            cloud: cloudId,
            module: dbEngineModuleMapping[instance.engine],
            viewDetails: {
              ...viewData,
              position: {
                x: 900,
                y: iterator * 200
              }
            }
          }
        });
        iterator++;
      }
      delete existingServices[instance.identifier];
    }

    for(const key in existingServices) {
      await client.delete('components', existingServices[key]);
    }
  }
}