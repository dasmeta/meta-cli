import * as ini from 'ini';
import * as os from 'os';
import * as fs from 'fs';
import { execSync, spawn } from 'child_process';
import { CloudProvider } from './CloudProvider';
import { Client, getClients, setClustersList, getClustersList } from './utils';
import { PLATFORM, PROVIDER } from './types';

class AWSProvider implements CloudProvider {

    private clients: Client[];

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

        execSync(`unset AWS_VAULT && export META_CLIENT_NAME=${environment.name}-${environment.alias} META_CLIENT_REGION=${environment.defaultRegion} META_CLIENT_PROVIDER="${environment.cloud}" && aws-vault exec ${environment.name}-${environment.alias}`, { stdio: 'inherit' });
    }

    getClusterList(region?: string): string {
        const clusters = getClustersList(process.env.META_CLIENT_NAME) as [];
        return clusters.join('\t');
    }

    getEnv(): {[key: string]: any} {
        const output = execSync(`unset AWS_VAULT && aws-vault exec ${process.env.META_CLIENT_NAME} -- env | grep AWS`).toString().trim();
        return output.split('\n').reduce((acc, item) => {
            const indexOfEquals = item.indexOf('=');
            if (indexOfEquals !== -1) {
                const key = item.substring(0, indexOfEquals);
                const value = item.substring(indexOfEquals + 1);
                acc[key] = value;
            }
            return acc;
        }, {});
    }

    updateKubeConfig(name: string, region: string, clientName: string): void {
        execSync(`aws eks update-kubeconfig --region ${region} --name ${name} --kubeconfig=${os.homedir}/.kube/${clientName}-${name}`, { stdio: 'inherit' });
   
        let shell = spawn(process.env.SHELL, [], {
            env: {
                ...process.env,
                KUBECONFIG: `${os.homedir}/.kube/${clientName}-${name}`
            },
            stdio: 'inherit'
          });

        shell.on('exit', (code) => {
            console.log(`Child shell exited with code ${code}`);
        });
    
    }
}

export default AWSProvider;