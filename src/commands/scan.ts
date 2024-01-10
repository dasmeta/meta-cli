import {Command, Flags} from '@oclif/core';
import chalk from 'chalk';
import sift from 'sift';
import { cloneDeep } from 'lodash';
import BackendClient from '../BackendClient';
import { getModuleByIdentifier, getOrCreateDefaultProject, getOrCreateModuleVersion } from '../service';
import { getProvider } from '../utils';
import { COMPONENT_SOURCE, Component, PROVIDER } from '../types';

const fixRegex = (query: any): any => {

  const queryObj = cloneDeep(query);

  if (queryObj !== null && typeof queryObj === 'object') {
    for (let key in queryObj) {
        if (queryObj.hasOwnProperty(key)) {
            // If the property is an object, recursively call the function
            if (typeof queryObj[key] === 'object') {
              queryObj[key] = fixRegex(queryObj[key]);
            }
        }
    }

    if ('$regex' in queryObj && ('$options' in queryObj || queryObj['$options'] === undefined)) {
        return new RegExp(queryObj['$regex'], queryObj['$options'] || '');
    }
  } else if (Array.isArray(queryObj)) {
      // Iterate through each element if obj is an array
      return queryObj.map(fixRegex);
  }

  return queryObj;
}

const getAssociatedProject = (projectAccountData: any, component: Component) => {

  for(const projectAccount of projectAccountData) {
      if(!projectAccount.attributes.filter) {
          continue;
      }

      const filter = fixRegex(projectAccount.attributes.filter);

      const filteredData = [component.rawData].filter(sift(filter));
      if(filteredData.length) {
          return projectAccount.attributes.project.data;
      }
  }

  return false;
}

export default class Scan extends Command {
  static description = 'generates metacloud.yaml and _metacloud.tf files and openes new shell with generated environment variables';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --force',
  ]

  static flags = {
    'log-level': Flags.integer({ description: 'Defines log level (1 = scan processing, 2 = unassociated components)', options: ['1', '2']}),
  }

  static args = {}

  public async run(): Promise<void> {

    const { flags } = await this.parse(Scan);

    if(!process.env.META_CLIENT_NAME) {
      this.log(chalk.red(`No active client found. Please run "${this.config.bin} exec" first`));
      return;
    }

    const log = (text: string, type: string = '') => {
      if(!flags['log-level']) {
        return;
      }

      if(type === 'success') {
        this.log(chalk.green(text));
        return;
      }

      this.log(chalk.gray(text));
    }

    const logAssociate = (data: {[key: string]: any}) => {
      if(flags['log-level'] === 2) {
        this.log(chalk.cyan('To associated component with project you need to add filters to projects.'));
        this.log(chalk.cyan('Filter must be applied to component with data:'));
        this.log(chalk.cyan(JSON.stringify(data, null, 2)));
        this.log(chalk.cyan(`For filter syntax please refer to https://www.npmjs.com/package/sift?activeTab=readme`));
      }
    }
    
    log(`Starting component scan for provider ${process.env.META_CLIENT_PROVIDER} ...`);
    const scannedComponents = await getProvider(process.env.META_CLIENT_PROVIDER as PROVIDER).scan();
    log(`${scannedComponents.length} components were found.`);

    const client = new BackendClient();

    log(`Starting saving process ...`);

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

    const defaultProject = await getOrCreateDefaultProject(clientId, clientName);

    const { data: projectAccountsData } = await client.get('project-accounts', {
      filters: {
        account: {
          id: {
            $eq: accountId
          }
        },
      },
      populate: 'project' 
    });

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

      log(`--- Component "${component.identifier}" ---`);

      // find module
      let moduleId = component.type;
      let moduleVersion = null;

      if(component.moduleName) {

        const foundModule = await getModuleByIdentifier(component.moduleName);

        if(foundModule) {
          moduleId = foundModule.id;
          
          if(component.moduleVersion) {
            moduleVersion = await getOrCreateModuleVersion(moduleId, component.moduleVersion);
          }

          log(`Found module "${foundModule.attributes.name}". Assigning to module with version ${moduleVersion.attributes.version}`);
        } else {
          log('No associated module found. Assigning to default module.');
        }
      }

      // find project
      let projectId = defaultProject.id;
      if(projectAccountsData.data.length) {
        const associatedProject = getAssociatedProject(projectAccountsData.data, component);
        if(associatedProject) {
          projectId = associatedProject.id;
          log(`Found project "${associatedProject.attributes.name}".`);
        } else {
          log('No associated project found. Assigning to default project.');
          logAssociate(component.rawData);
        }
      } else {
        log('No associated project found. Assigning to default project.');
        logAssociate(component.rawData);
      }

      if(!existingServices[component.identifier]) {

        await client.post('components', {
          data: {
            name: component.name,
            project: projectId,
            identifier: component.identifier,
            cloud: cloudId,
            account: accountId,
            module: moduleId,
            module_version: moduleVersion ? moduleVersion.id : null,
            source: COMPONENT_SOURCE.SCANNER,
            raw_data: component.rawData,
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
      } else {
        await client.put(`components/${existingServices[component.identifier]}`, {
          data: {
            project: projectId,
            module: moduleId,
            module_version: moduleVersion ? moduleVersion.id : null,
            source: COMPONENT_SOURCE.SCANNER,
            raw_data: component.rawData
          }
        })
      }
      delete existingServices[component.identifier];

      log('Done.', 'success');
    }

    if(Object.keys(existingServices).length) {
      log(`Found ${Object.keys(existingServices).length} stale components.`);
      log('Archiving...');
    }

    for(const key in existingServices) {
      await client.put(`components/${existingServices[key]}`, {
        data: {
          archived: true
        }
      });
    }

    log('Scan has been finished.', 'success');
  }
}