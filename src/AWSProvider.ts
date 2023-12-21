import ini from 'ini';
import os from 'os';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { uniqBy } from 'lodash';
import { 
    DescribeClusterCommand, 
    EKSClient, 
    ListClustersCommand, 
} from '@aws-sdk/client-eks';
import {
    RDSClient,
    DescribeDBInstancesCommand
} from '@aws-sdk/client-rds';
import {
    S3Client,
    ListBucketsCommand
} from '@aws-sdk/client-s3'

import * as k8s from '@kubernetes/client-node';
import { Client } from './utils';
import { 
    Account, 
    Component,
    DB_ENGINE, 
    Environment, 
    PLATFORM, 
    PROVIDER, 
    UNKNOWN_MODULE, 
    BucketData, 
    ClusterData, 
    DbData } from './types';
import { Provider } from './Provider';

// deployment statefulset cronjob (job daemonset) 

const dbEngineModuleMapping = {
    [DB_ENGINE.POSTGRES]: UNKNOWN_MODULE.POSTGRES,
    [DB_ENGINE.MARIADB]: UNKNOWN_MODULE.MARIADB
}

class AWSProvider implements Provider {

    private excludedKubernetesNamespaces = [
        'cert-manager',
        'kube-node-lease',
        'kube-public',
        'kube-system',
        'linkerd',
        'meta-system',
    ];

    generateConfig(account: Account): void {

        if(!fs.existsSync(`${os.homedir}/.aws`)) {
            fs.mkdirSync(`${os.homedir}/.aws`);
        }

        if(!fs.existsSync(`${os.homedir}/.aws/config`)) {
            fs.writeFileSync(`${os.homedir}/.aws/config`, '')
        }

        const config = ini.parse(fs.readFileSync(`${os.homedir}/.aws/config`, 'utf-8'));

        if(account.provider !== PROVIDER.AWS) {
            return;
        }

        config[`profile ${account.name}-${account.alias}`] = {
            'sso_start_url': `https://${account.ssoAlias}.awsapps.com/start`,
            'sso_region': account.defaultRegion,
            'sso_account_id': account.accountId,
            'sso_role_name': account.defaultRole,
            'region': account.defaultRegion
        }

        fs.writeFileSync(`${os.homedir}/.aws/config`, ini.stringify(config))
    }

    open(account: Account): void {
        const platform = os.platform();
        if(platform === PLATFORM.MACOS) {
          execSync(`aws-vault login ${account.name}-${account.alias} --stdout | xargs -t /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --args --no-first-run --new-window -disk-cache-dir=$(mktemp -d /tmp/chrome.XXXXXX) --user-data-dir=$(mktemp -d /tmp/chrome.XXXXXX) > /dev/null 2>&1 &`, { stdio: 'ignore' });
        } else {
          execSync(`aws-vault login ${account.name}-${account.alias}`);
        }
    }

    exec(account: Account): Environment {

        const vaultCommandPrefix = `unset AWS_VAULT && aws-vault exec ${account.name}-${account.alias} --`;

        const clustersOutput = execSync(`${vaultCommandPrefix} aws eks list-clusters --query "clusters[]" --output text`).toString().trim();
        const clusters = clustersOutput.split('\t');

        for(const cluster of clusters) {
            execSync(`${vaultCommandPrefix} aws eks update-kubeconfig --region ${account.defaultRegion} --name ${cluster} --kubeconfig=${os.homedir}/.kube/${account.name}-${account.alias}-${cluster}`, { stdio: 'inherit' });
        }

        const envOutput = execSync(`${vaultCommandPrefix} env | grep AWS`).toString().trim();
        const env = envOutput.split('\n').reduce((acc: any, item) => {
            const indexOfEquals = item.indexOf('=');
            if (indexOfEquals !== -1) {
                const key = item.substring(0, indexOfEquals);
                const value = item.substring(indexOfEquals + 1);
                acc[key] = value;
            }
            return acc;
        }, {});

        return env;
    }

    getEnv(): Environment {
        const output = execSync(`unset AWS_VAULT && aws-vault exec ${process.env.META_CLIENT_NAME} -- env | grep AWS`).toString().trim();
        return output.split('\n').reduce((acc: any, item) => {
            const indexOfEquals = item.indexOf('=');
            if (indexOfEquals !== -1) {
                const key = item.substring(0, indexOfEquals);
                const value = item.substring(indexOfEquals + 1);
                acc[key] = value;
            }
            return acc;
        }, {});
    }

    async scan(): Promise<Component[]> {
        const data: Component[] = [];

        const dbData = await this.scanDatabases();
        const bucketData = await this.scanBuckets();

        dbData.forEach(item => {
            data.push({
                name: item.name,
                identifier: item.identifier,
                type: dbEngineModuleMapping[item.engine]
            })
        });

        bucketData.forEach(item => {
            data.push({
                name: item.name,
                identifier: item.name,
                type: UNKNOWN_MODULE.S3
            })
        });

        return data;
    }

    private async scanDatabases(): Promise<DbData> {
        const rdsClient = new RDSClient({});

        const dbInstancesCommand = new DescribeDBInstancesCommand({});
        const dbInstances = await rdsClient.send(dbInstancesCommand);

        const dbData: DbData = [];

        for(const instance of dbInstances.DBInstances || []) {

            dbData.push({ 
                name: instance.DBInstanceIdentifier as string, 
                identifier: instance.DBInstanceIdentifier as string,
                engine: instance.Engine as DB_ENGINE,
            })
        }

        return dbData;
    }

    private async scanBuckets(): Promise<BucketData> {
        const s3Client = new S3Client({});

        const listBucketsCommand = new ListBucketsCommand({});
        const buckets = await s3Client.send(listBucketsCommand);
        
        const bucketData: BucketData = [];

        for(const bucket of buckets.Buckets || []) {
            bucketData.push({ name: bucket.Name as string });
        }

        return bucketData;
    }
}

export default AWSProvider;