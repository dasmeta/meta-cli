import * as os from 'os';
import * as fs from 'fs';
import { PROVIDER } from './types';
import AWSProvider from './AWSProvider';
import { CloudProvider } from './CloudProvider';

export type Config = {
    apiKey: string;
}

export type Client = {
    name: string;
    accountId: string;
    alias: string;
    cloud: PROVIDER;
    defaultRegion: string;
    defaultRole: string;
    ssoAlias: string;
}

function setConfig(config: Config) {
    const metaDir = `${os.homedir()}/.meta`;

    if(!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir)
    }

    fs.writeFileSync(`${metaDir}/config.json`, JSON.stringify(config));
}

function getConfig(): Config|boolean {
    if(!fs.existsSync(`${os.homedir}/.meta/config.json`)) {
        return false;
    }

    const data = fs.readFileSync(`${os.homedir}/.meta/config.json`, 'utf8');
    return JSON.parse(data) as Config;
}

function setClients(clients: Client[]) {

    const metaDir = `${os.homedir()}/.meta`;

    if(!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir)
    }

    fs.writeFileSync(`${metaDir}/clients.json`, JSON.stringify(clients));
} 

function getClients(): Client[]|boolean {
    if(!fs.existsSync(`${os.homedir}/.meta/clients.json`)) {
        return false;
    }

    const data = fs.readFileSync(`${os.homedir}/.meta/clients.json`, 'utf8');
    return JSON.parse(data) as Client[];
}

function setClustersList(name: string, clusters: string[]) {
    const metaDir = `${os.homedir()}/.meta`;

    if(!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir)
    }

    fs.writeFileSync(`${metaDir}/${name}-clusters.json`, JSON.stringify(clusters));
}

function getClustersList(name: string): string[]|boolean {
    if(!fs.existsSync(`${os.homedir}/.meta/${name}-clusters.json`)) {
        return false;
    }

    const data = fs.readFileSync(`${os.homedir}/.meta/${name}-clusters.json`, 'utf8');
    return JSON.parse(data);
}

function getCloudProvider(provider: PROVIDER): CloudProvider {
    if(provider === PROVIDER.AWS) {
        return new AWSProvider();
    }

    throw new Error (`Unknown provider: ${provider}`);
}

export {
    setConfig,
    getConfig,
    setClients,
    getClients,
    setClustersList,
    getClustersList,
    getCloudProvider
}