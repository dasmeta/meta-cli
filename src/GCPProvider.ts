import ini from 'ini';
import os from 'os';
import fs from 'fs';
import { omit, lowerCase } from 'lodash';
import { execSync } from 'child_process';
import { v1 } from '@google-cloud/sql';
import { Storage } from '@google-cloud/storage';

import { 
    Account, 
    Component,
    DB_ENGINE, 
    Environment, 
    PROVIDER, 
    UNKNOWN_MODULE, 
    BucketData, 
    DbData } from './types';
import { Provider } from './Provider';

const dbEngineModuleMapping = {
    [DB_ENGINE.POSTGRES]: UNKNOWN_MODULE.POSTGRES_GCP,
    [DB_ENGINE.MYSQL]: UNKNOWN_MODULE.MYSQL_GCP,
    [DB_ENGINE.MARIADB]: 0
}

class GCPProvider implements Provider {

    generateConfig(account: Account): void {

        if(!fs.existsSync(`${os.homedir}/.config/gcloud`)) {
            fs.mkdirSync(`${os.homedir}/.config/gcloud`);
        }

        if(!fs.existsSync(`${os.homedir}/.config/gcloud/configurations`)) {
            fs.mkdirSync(`${os.homedir}/.config/gcloud/configurations`);
        }

        if(!fs.existsSync(`${os.homedir}/.config/gcloud/configurations/config_${account.name}-${account.alias}`)) {
            fs.writeFileSync(`${os.homedir}/.config/gcloud/configurations/config_${account.name}-${account.alias}`, '')
        }

        const config = ini.parse(fs.readFileSync(`${os.homedir}/.config/gcloud/configurations/config_${account.name}-${account.alias}`, 'utf-8'));

        if(account.provider !== PROVIDER.GCP) {
            return;
        }

        config['core'] = {
            'project': account.accountId
        }

        config['compute'] = {
            'zone': account.zone,
            'region': account.region
        }

        fs.writeFileSync(`${os.homedir}/.config/gcloud/configurations/config_${account.name}-${account.alias}`, ini.stringify(config))
    }

    open(account: Account): void {
        console.log(`Provider ${account.provider} does not support open`);
    }

    exec(account: Account): Environment {

        execSync(`CLOUDSDK_ACTIVE_CONFIG_NAME=${account.name}-${account.alias} gcloud auth login && CLOUDSDK_ACTIVE_CONFIG_NAME=${account.name}-${account.alias} gcloud auth application-default login`);
        execSync(`mv ${os.homedir}/.config/gcloud/application_default_credentials.json ${os.homedir}/.config/gcloud/credentials_${account.name}-${account.accountId}.json`);

        const output = execSync(`CLOUDSDK_ACTIVE_CONFIG_NAME=${account.name}-${account.alias} gcloud container clusters list --format=json`).toString().trim();

        const clusters = JSON.parse(output);
        for(const cluster of clusters) {
            execSync(`CLOUDSDK_ACTIVE_CONFIG_NAME=${account.name}-${account.alias} KUBECONFIG=${os.homedir}/.kube/${account.name}-${account.alias}-${cluster.name} gcloud container clusters get-credentials ${cluster.name}`)
        }

        const env = {
            "CLOUDSDK_ACTIVE_CONFIG_NAME": `${account.name}-${account.alias}`,
            "GOOGLE_APPLICATION_CREDENTIALS": `${os.homedir}/.config/gcloud/credentials_${account.name}-${account.accountId}.json`
        };

        return env;
    }

    getEnv(): Environment {
        return {};
    }

    async scan(): Promise<Component[]> {
        const data: Component[] = [];

        const dbData = await this.scanDatabases();
        const bucketData = await this.scanBuckets();

        dbData.forEach(item => {
            data.push({
                ...item,
                type: dbEngineModuleMapping[item.engine]
            })
        });

        bucketData.forEach(item => {
            data.push({
                ...item,
                identifier: item.name,
                type: UNKNOWN_MODULE.GCS,
            })
        });

        return data;
    }

    private getDbType(version: string) {
        const splitted = version.split('_');
        return lowerCase(splitted[0]);
    }

    private async scanDatabases(): Promise<DbData[]> {

        const instancesClient = new v1.SqlInstancesServiceClient({
            fallback: 'rest',
        });

        const project = await instancesClient.getProjectId()
        let data: any = [];

        try {
            data = await instancesClient.list({ project });
        } catch(e: any) {
            console.log(e.message);
        }
        
        const dbData: DbData[] = [];

        for(const instance of data[0].items) {

            const data: DbData = { 
                name: instance.name, 
                identifier: instance.name,
                engine: this.getDbType(instance.databaseVersion) as DB_ENGINE,
                rawData: omit(instance, ['serverCaCert'])
            };

            dbData.push(data);
        }

        return dbData;
    }

    private async scanBuckets(): Promise<BucketData[]> {

        const storage = new Storage();
        
        const bucketData: BucketData[] = [];

        const buckets = await storage.getBuckets();

        for(const bucket of buckets[0]) {
            const data: BucketData = {
                name: bucket.name,
                rawData: bucket.metadata
            }

            bucketData.push(data);
        }

        return bucketData;
    }
}

export default GCPProvider;