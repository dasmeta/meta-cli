import os from 'os';
import { uniqBy } from 'lodash';
import * as k8s from '@kubernetes/client-node';
import { Account, Component, Environment, UNKNOWN_MODULE, ClusterData } from './types';
import { Provider } from './Provider';
import { getAccount } from './utils';

// deployment statefulset cronjob (job daemonset) 

class KubernetesProvider implements Provider {

    private excludedKubernetesNamespaces = [
        'cert-manager',
        'kube-node-lease',
        'kube-public',
        'kube-system',
        'linkerd',
        'meta-system',
    ];

    generateConfig(account: Account): void {}

    exec(account: Account): Environment {
        return {
            KUBECONFIG: `${os.homedir}/.kube/${account.parentAccount?.name}-${account.parentAccount?.alias}-${account.alias}`
        }
    }

    async scan(): Promise<Component[]> {
        const kc = new k8s.KubeConfig();

        const account = getAccount(process.env.META_ACCOUNT_ID as string) as Account;
        const excludedNamespaces = account.excludedNamespaces || [];

        const clusterData: ClusterData = { 
            services: [],
            storages: [],
            cronjobs: [],
        };

        const services: Array<any> = [];
        const storages: Array<any> = [];
        const cronjobs: Array<any> = [];
  
        kc.loadFromDefault();

        const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
        const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
        const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

        const namespacesRes = await k8sCoreApi.listNamespace();
        const namespaces = namespacesRes.body.items
            .map(item => item.metadata?.name)
            .filter((item:any) => !excludedNamespaces.includes(item));

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

        clusterData.services = uniqBy(services, (item) => item.identifier);
        clusterData.storages = uniqBy(storages, (item) => item.identifier);
        clusterData.cronjobs = uniqBy(cronjobs, (item) => item.identifier);

        const data: Component[] = [];

        data.push(...clusterData.services.map((item: any) => ({
            ...item,
            type: UNKNOWN_MODULE.APPLICATION
        })));

        data.push(...clusterData.storages.map((item: any) => ({
            ...item,
            type: UNKNOWN_MODULE.APPLICATION
        })));

        data.push(...clusterData.cronjobs.map((item: any) => ({
            ...item,
            type: UNKNOWN_MODULE.APPLICATION
        })));

        return data;
    }

    getEnv(): Environment {
        return {};
    }

    open(account: Account): void {
        console.log(`Provider ${account.provider} does not support open`);
    }
}

export default KubernetesProvider;