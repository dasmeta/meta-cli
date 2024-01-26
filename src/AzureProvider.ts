import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import { 
    Account, 
    Component,
    Environment, 
} from './types';
import { Provider } from './Provider';

class AzureProvider implements Provider {

    generateConfig(account: Account): void {

        if(!fs.existsSync(`${os.homedir}/.azure`)) {
            fs.mkdirSync(`${os.homedir}/.azure`);
        }

        if(!fs.existsSync(`${os.homedir}/.azure/accounts`)) {
            fs.mkdirSync(`${os.homedir}/.azure/accounts`);
        }

        if(!fs.existsSync(`${os.homedir}/.azure/accounts/${account.name}-${account.alias}`)) {
            fs.mkdirSync(`${os.homedir}/.azure/accounts/${account.name}-${account.alias}`);
        }
    }

    open(account: Account): void {
        console.log(`Provider ${account.provider} does not support open`);
    }

    exec(account: Account): Environment {

        execSync(`AZURE_CONFIG_DIR=${os.homedir}/.azure/accounts/${account.name}-${account.alias} az login --allow-no-subscriptions`);

        const output = execSync(`AZURE_CONFIG_DIR=${os.homedir}/.azure/accounts/${account.name}-${account.alias} AZURE_SUBSCRIPTION_ID=${account.accountId} az aks list --output json`).toString().trim();

        const clusters = JSON.parse(output);

        for(const cluster of clusters) {
            execSync(`AZURE_CONFIG_DIR=${os.homedir}/.azure/accounts/${account.name}-${account.alias} AZURE_SUBSCRIPTION_ID=${account.accountId} az aks get-credentials --resource-group ${cluster.resourceGroup} --name ${cluster.name} --file ${os.homedir}/.kube/${account.name}-${account.alias}-${cluster.name}`)
        }

        const env = {
            "AZURE_CONFIG_DIR": `${os.homedir}/.azure/accounts/${account.name}-${account.alias}`,
            "AZURE_SUBSCRIPTION_ID": account.accountId
        };

        return env;
    }

    getEnv(): Environment {
        return {};
    }

    async scan(): Promise<Component[]> {
        const data: Component[] = [];

        return data;
    }
}

export default AzureProvider;