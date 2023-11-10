import * as ini from 'ini';
import * as os from 'os';
import * as fs from 'fs';
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
import { BucketData, CloudProvider, ClusterData, DbData } from './CloudProvider';
import { Client, getClients, setClustersList, getClustersList } from './utils';
import { DB_ENGINE, PLATFORM, PROVIDER } from './types';

// deployment statefulset cronjob (job daemonset) 

class AWSProvider implements CloudProvider {

    private clients: Client[];

    private excludedKubernetesNamespaces = [
        'cert-manager',
        'kube-node-lease',
        'kube-public',
        'kube-system',
        'meta-system',
    ];

    constructor () {
        this.clients = getClients() as Client[];
    }

    generateConfig(): void {

        if(!fs.existsSync(`${os.homedir}/.aws`)) {
            fs.mkdirSync(`${os.homedir}/.aws`);
        }

        if(!fs.existsSync(`${os.homedir}/.aws/config`)) {
            fs.writeFileSync(`${os.homedir}/.aws/config`, '')
        }

        const config = ini.parse(fs.readFileSync(`${os.homedir}/.aws/config`, 'utf-8'));

        this.clients
            .filter(item => item.cloud === PROVIDER.AWS)
            .forEach(item => {
                config[`profile ${item.name}-${item.alias}`] = {
                    'sso_start_url': `https://${item.ssoAlias}.awsapps.com/start`,
                    'sso_region': item.defaultRegion,
                    'sso_account_id': item.accountId,
                    'sso_role_name': item.defaultRole,
                    'region': item.defaultRegion
                }
            })

        fs.writeFileSync(`${os.homedir}/.aws/config`, ini.stringify(config))
    }

    openSSO(environment: Client): void {
        const platform = os.platform();
        if(platform === PLATFORM.MACOS) {
          execSync(`aws-vault login ${environment.name}-${environment.alias} --stdout | xargs -t /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --args --no-first-run --new-window -disk-cache-dir=$(mktemp -d /tmp/chrome.XXXXXX) --user-data-dir=$(mktemp -d /tmp/chrome.XXXXXX) > /dev/null 2>&1 &`, { stdio: 'ignore' });
        } else {
          execSync(`aws-vault login ${environment.name}-${environment.alias}`);
        }
    }

    exec(environment: Client): void {
        const output = execSync(`unset AWS_VAULT && aws-vault exec ${environment.name}-${environment.alias} -- aws eks list-clusters --query "clusters[]" --output text`).toString().trim();

        const clusters = output.split('\t');

        setClustersList(`${environment.name}-${environment.alias}`, clusters);

        execSync(`unset AWS_VAULT && export META_ACCOUNT_ID=${environment.accountId} META_CLIENT_NAME=${environment.name}-${environment.alias} META_CLIENT_REGION=${environment.defaultRegion} META_CLIENT_PROVIDER="${environment.cloud}" && aws-vault exec ${environment.name}-${environment.alias}`, { stdio: 'inherit' });
    }

    getClusterList(region?: string): string {
        const clusters = getClustersList(process.env.META_CLIENT_NAME as string) as [];
        return clusters.join('\t');
    }

    getEnv(): {[key: string]: any} {
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

    updateKubeConfig(name: string): void {
        execSync(`aws eks update-kubeconfig --region ${process.env.META_CLIENT_REGION} --name ${name} --kubeconfig=${os.homedir}/.kube/${process.env.META_CLIENT_NAME}-${name}`, { stdio: 'inherit' });
   
        let shell = spawn(process.env.SHELL as string, [], {
            env: {
                ...process.env,
                KUBECONFIG: `${os.homedir}/.kube/${process.env.META_CLIENT_NAME}-${name}`
            },
            stdio: 'inherit'
          });

        shell.on('exit', (code) => {
            console.log(`Child shell exited with code ${code}`);
        });
    
    }

    async scanClusters(): Promise<ClusterData> {

        const eksClient = new EKSClient({});

        const command = new ListClustersCommand({});
        const data = await eksClient.send(command);

        const clusters = data.clusters || [];

        const clusterData: ClusterData = { 
            services: [],
            storages: [],
            cronjobs: [],
        };

        const services: Array<any> = [];
        const storages: Array<any> = [];
        const cronjobs: Array<any> = [];

        for(const clusterName of clusters) {

            const describeClusterCommand = new DescribeClusterCommand({name: clusterName});
            const data = await eksClient.send(describeClusterCommand);

            const kc = new k8s.KubeConfig();
            kc.loadFromOptions({
                clusters: [{
                    name: data.cluster?.name || '',
                    server: data.cluster?.endpoint || '',
                    caData: data.cluster?.certificateAuthority?.data,
                }],
                users: [{
                    name: 'aws',
                    exec: {
                        apiVersion: 'client.authentication.k8s.io/v1alpha1',
                        command: 'aws',
                        args: ['--region', process.env.META_CLIENT_REGION, 'eks', 'get-token', '--cluster-name', data.cluster?.name],
                        env: null
                    }
                }],
                contexts: [
                    {
                      name: 'aws',
                      user: 'aws',
                      cluster: data.cluster?.name || ''
                    }
                  ],
                  currentContext: 'aws',
            });

            const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
            const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
            const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

            const namespacesRes = await k8sCoreApi.listNamespace();
            const namespaces = namespacesRes.body.items
                .map(item => item.metadata?.name)
                .filter((item:any) => !this.excludedKubernetesNamespaces.includes(item));

            for(const namespace of namespaces) {

                const podsRes = await k8sCoreApi.listNamespacedPod(namespace as string);

                const deploymentsRes = await k8sAppsApi.listNamespacedDeployment(namespace as string);
                const statefulsetRes = await k8sAppsApi.listNamespacedStatefulSet(namespace as string);
                const jobsRes = await k8sBatchApi.listNamespacedJob(namespace as string);

                const jobToCronJobMap: {[key: string]: any} = {};

                jobsRes.body.items.forEach(job => {
                    const ownerReferences = job.metadata?.ownerReferences || [];
                    ownerReferences.forEach((item) => {
                        if(item.kind === 'CronJob') {
                            jobToCronJobMap[job.metadata?.name || ''] = {
                                name: item.name,
                                uid: item.uid
                            }; 
                        }
                    })
                });

                for(const pod of podsRes.body.items) {

                    const podLabels = pod.metadata?.labels || {}; 
                    const podOwnerReferences = pod.metadata?.ownerReferences || [];

                    for(const deployment of deploymentsRes.body.items) {
                        const matchLabels = deployment.spec?.selector.matchLabels || {};
                        if(Object.keys(matchLabels).every((key) => podLabels[key] === matchLabels[key] )) {
                            services.push({
                                name: deployment.metadata?.name,
                                identifier: deployment.metadata?.uid
                            })
                        }
                    }

                    for(const statefulset of statefulsetRes.body.items) {
                        const matchLabels = statefulset.spec?.selector.matchLabels || {};
                        if(Object.keys(matchLabels).every((key) => podLabels[key] === matchLabels[key] )) {
                            storages.push({
                                name: statefulset.metadata?.name,
                                identifier: statefulset.metadata?.uid
                            })
                        }
                    }

                    for(const reference of podOwnerReferences) {
                        if(reference.kind === 'Job' && jobToCronJobMap[reference.name]) {
                            cronjobs.push({
                                name: jobToCronJobMap[reference.name].name,
                                identifier: jobToCronJobMap[reference.name].uid
                            })
                        }
                    }
                }
            }
        }

        clusterData.services = uniqBy(services, (item) => item.identifier);
        clusterData.storages = uniqBy(storages, (item) => item.identifier);
        clusterData.cronjobs = uniqBy(cronjobs, (item) => item.identifier);

        return clusterData;
    }

    async scanDatabases(): Promise<DbData> {
        const rdsClient = new RDSClient({});

        const dbInstancesCommand = new DescribeDBInstancesCommand({});
        const dbInstances = await rdsClient.send(dbInstancesCommand);

        const dbData: DbData = [];

        for(const instance of dbInstances.DBInstances || []) {

            dbData.push({ 
                name: instance.DBInstanceIdentifier as string, 
                identifier: instance.DbiResourceId as string,
                engine: instance.Engine as DB_ENGINE,
            })
        }

        return dbData;
    }

    async scanBuckets(): Promise<BucketData> {
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