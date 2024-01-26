import ini from 'ini';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

import {
    RDSClient,
    DescribeDBInstancesCommand
} from '@aws-sdk/client-rds';

import {
    S3Client,
    ListBucketsCommand,
    GetBucketTaggingCommand
} from '@aws-sdk/client-s3';

import {
    ListQueuesCommand,
    SQSClient,
    GetQueueAttributesCommand,
    ListQueueTagsCommand,
} from '@aws-sdk/client-sqs';

import {
    DescribeElasticsearchDomainCommand,
    ElasticsearchServiceClient,
    ListDomainNamesCommand,
    ListTagsCommand,
} from '@aws-sdk/client-elasticsearch-service';

import {
    ElastiCacheClient,
    DescribeCacheClustersCommand,
    ListTagsForResourceCommand
} from '@aws-sdk/client-elasticache';

import { 
    Account, 
    Component,
    DB_ENGINE, 
    Environment, 
    PLATFORM, 
    PROVIDER, 
    UNKNOWN_MODULE, 
    BucketData, 
    QueueData,
    DbData, 
    ElasticSearchData,
    ElastiCacheData,
    CACHE_ENGINE
} from './types';
import { Provider } from './Provider';

const dbEngineModuleMapping = {
    [DB_ENGINE.POSTGRES]: UNKNOWN_MODULE.POSTGRES,
    [DB_ENGINE.MARIADB]: UNKNOWN_MODULE.MARIADB,
    [DB_ENGINE.MYSQL]: UNKNOWN_MODULE.MYSQL
}

const cacheEngineModuleMapping = {
    [CACHE_ENGINE.REDIS]: UNKNOWN_MODULE.REDIS_AWS
}

class AWSProvider implements Provider {

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
            'region': account.region || account.defaultRegion
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
        const clusters = clustersOutput.split('\t').filter(Boolean);

        for(const cluster of clusters) {
            execSync(`${vaultCommandPrefix} aws eks update-kubeconfig --region ${account.region || account.defaultRegion} --name ${cluster} --kubeconfig=${os.homedir}/.kube/${account.name}-${account.alias}-${cluster}`, { stdio: 'inherit' });
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
        const queueData = await this.scanQueues();
        const esData = await this.scanElasticSearch();
        const ecData = await this.scanElastiCache();

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
                type: UNKNOWN_MODULE.S3,
            })
        });

        queueData.forEach(item => {
            data.push({
                ...item,
                type: UNKNOWN_MODULE.SQS
            })
        });

        esData.forEach(item => {
            data.push({
                ...item,
                type: UNKNOWN_MODULE.ES_AWS
            })
        });

        ecData.forEach(item => {
            data.push({
                ...item,
                type: cacheEngineModuleMapping[item.engine]
            })
        });

        return data;
    }

    private getQueueName(arn: string): string {
        return arn.split(':').pop() || '';
    }

    private async scanDatabases(): Promise<DbData[]> {
        const rdsClient = new RDSClient({});

        const dbInstancesCommand = new DescribeDBInstancesCommand({});
        const dbInstances = await rdsClient.send(dbInstancesCommand);

        const dbData: DbData[] = [];

        for(const instance of dbInstances.DBInstances || []) {

            const data: DbData = { 
                name: instance.DBInstanceIdentifier as string, 
                identifier: instance.DBInstanceIdentifier as string,
                engine: instance.Engine as DB_ENGINE,
                rawData: instance
            };

            const moduleName = instance.TagList?.find(item => item.Key === 'TerraformModuleSource');
            const moduleVersion = instance.TagList?.find(item => item.Key === 'TerraformModuleVersion');

            if(moduleName) {
                data.moduleName = moduleName.Value;
            }
            if(moduleVersion) {
                data.moduleVersion = moduleVersion.Value;
            }

            dbData.push(data);
        }

        return dbData;
    }

    private async scanBuckets(): Promise<BucketData[]> {
        const s3Client = new S3Client({});

        const listBucketsCommand = new ListBucketsCommand({});
        const buckets = await s3Client.send(listBucketsCommand);
        
        const bucketData: BucketData[] = [];

        for(const bucket of buckets.Buckets || []) {

            const getBucketTaggingCommand = new GetBucketTaggingCommand({ Bucket: bucket.Name });
            const taglist = await s3Client.send(getBucketTaggingCommand);

            const data: BucketData = { 
                name: bucket.Name as string,
                rawData: {
                    ...bucket,
                    TagSet: taglist.TagSet
                }
            }

            const moduleName = taglist.TagSet?.find(item => item.Key === 'TerraformModuleSource');
            const moduleVersion = taglist.TagSet?.find(item => item.Key === 'TerraformModuleVersion');

            if(moduleName) {
                data.moduleName = moduleName.Value;
            }
            if(moduleVersion) {
                data.moduleVersion = moduleVersion.Value;
            }

            bucketData.push(data);
        }

        return bucketData;
    }

    private async scanQueues(): Promise<QueueData[]> {

        const sqsClient = new SQSClient({});

        const listQueuesCommand = new ListQueuesCommand({});
        const queues = await sqsClient.send(listQueuesCommand);

        const queueData: QueueData[] = [];

        for(const url of queues.QueueUrls || []) {

            const getQueueAttributesCommand = new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ['All'] });
            const listQueueTagsCommand = new ListQueueTagsCommand({QueueUrl: url});

            const queue = await sqsClient.send(getQueueAttributesCommand);
            const queueTags = await sqsClient.send(listQueueTagsCommand);

            const moduleName = queueTags?.Tags?.TerraformModuleSource;
            const moduleVersion = queueTags?.Tags?.TerraformModuleVersion;


            const data: QueueData = { 
                name: this.getQueueName(queue.Attributes?.QueueArn as string),
                identifier: queue.Attributes?.QueueArn as string,
                moduleName,
                moduleVersion,
                rawData: {
                    ...queue.Attributes,
                    Tags: queueTags.Tags
                }
            }

            queueData.push(data);
        }

        return queueData;
    }

    private async scanElasticSearch(): Promise<ElasticSearchData[]> {

        const esClient = new ElasticsearchServiceClient({});

        const listDomainNamesCommand = new ListDomainNamesCommand({});
        const esList = await esClient.send(listDomainNamesCommand);

        const esData: ElasticSearchData[] = [];

        for(const domainName of esList.DomainNames || []) {

            const describeElasticSearchDomain = new DescribeElasticsearchDomainCommand({ DomainName: domainName.DomainName });
            const esItem = await esClient.send(describeElasticSearchDomain);

            const listTagsCommand = new ListTagsCommand({ARN: esItem.DomainStatus?.ARN});
            const esItemTags = await esClient.send(listTagsCommand);

            const data: ElasticSearchData = { 
                name: esItem.DomainStatus?.DomainName as string,
                identifier: esItem.DomainStatus?.DomainId as string,
                rawData: {
                    ...esItem.DomainStatus,
                    TagList: esItemTags.TagList
                }
            }

            const moduleName = esItemTags.TagList?.find(item => item.Key === 'TerraformModuleSource');
            const moduleVersion = esItemTags.TagList?.find(item => item.Key === 'TerraformModuleVersion');

            if(moduleName) {
                data.moduleName = moduleName.Value;
            }
            if(moduleVersion) {
                data.moduleVersion = moduleVersion.Value;
            }

            esData.push(data);
        }

        return esData;
    }

    private async scanElastiCache(): Promise<ElastiCacheData[]> {

        const ecClient = new ElastiCacheClient({});

        const describeCacheClustersCommand = new DescribeCacheClustersCommand({});
        const ecList = await ecClient.send(describeCacheClustersCommand);

        const ecData: ElastiCacheData[] = [];

        for(const cluster of ecList.CacheClusters || []) {

            const listTagsCommand = new ListTagsForResourceCommand({ ResourceName: cluster.ARN })
            const tags = await ecClient.send(listTagsCommand);

            const data: ElastiCacheData = { 
                name: cluster.CacheClusterId as string,
                identifier: cluster.ARN as string,
                engine: cluster.Engine as CACHE_ENGINE,
                rawData: {
                    ...cluster,
                    TagList: tags.TagList
                }
            }

            const moduleName = tags.TagList?.find(item => item.Key === 'TerraformModuleSource');
            const moduleVersion = tags.TagList?.find(item => item.Key === 'TerraformModuleVersion');

            if(moduleName) {
                data.moduleName = moduleName.Value;
            }
            if(moduleVersion) {
                data.moduleVersion = moduleVersion.Value;
            }

            ecData.push(data);
        }

        return ecData;
    }
}

export default AWSProvider;