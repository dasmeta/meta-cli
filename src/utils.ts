import * as os from 'os';
import * as fs from 'fs';
import { parse } from 'yaml';
import { PROVIDER, GIT_PROVIDER } from './types';
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

export type MetaConfig = {
    tfCloudOrg: string;
    tfCloudWorkspace: string;
    gitProvider: GIT_PROVIDER;
    gitOrg: string;
    gitRepo: string;
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

function generateMetaCloudConfig(config: MetaConfig) {
    const metaCloudYaml = `terraform_cloud_org: ${config.tfCloudOrg}
terraform_cloud_workspace: ${config.tfCloudWorkspace}

git_provider: ${config.gitProvider}
git_org: ${config.tfCloudOrg}
git_repo: ${config.gitRepo}

auto_apply:
yaml_dir:
result_dir:

handler_version: v2.4.0
`;

    fs.writeFileSync(`metacloud.yaml`, metaCloudYaml);

    const metaCloudTf = `terraform {
    cloud {
        organization = "${config.tfCloudOrg}"
        workspaces { name = "${config.tfCloudWorkspace}" }
    }
}

variable "tfc_org" {}
variable "tfc_workspace" {}
variable "tfc_token" {}
variable "git_provider" {}
variable "git_org" {}
variable "git_repo" {}
variable "git_token" {}
variable "default_region" {}
variable "region" {}
variable "access_key_id" {}
variable "secret_access_key" {}
variable "session_token" {}
variable "security_token" {}

module "metacloud" {
  source  = "dasmeta/cloud/tfe"
  version = "~> v2.0.2"

  org   = var.tfc_org
  token = var.tfc_token

  rootdir   = "\${path.module}/_terraform/" # should be default value
  targetdir = "\${path.module}/_terraform" # should be default value
  yamldir   = "\${path.module}/."

  git_provider = var.git_provider
  git_org      = var.git_org
  git_repo     = var.git_repo
  git_token    = var.git_token

  aws = {
    access_key_id     = var.access_key_id
    secret_access_key = var.secret_access_key
    session_token     = var.session_token
    security_token    = var.security_token
    region            = var.region
    default_region    = var.default_region
  }
}
`;

    fs.writeFileSync(`_metacloud.tf`, metaCloudTf);
}

function getMetaCloudConfig(): MetaConfig|false {
    if(!fs.existsSync('metacloud.yaml')) {
        return false;
    }

    const yaml = fs.readFileSync('metacloud.yaml', 'utf-8');
    const data = parse(yaml);

    return {
        tfCloudOrg: data['terraform_cloud_org'],
        tfCloudWorkspace: data['terraform_cloud_workspace'],
        gitProvider: data['git_provider'],
        gitOrg: data['git_org'],
        gitRepo: data['git_repo']
    }
}

export {
    setConfig,
    getConfig,
    setClients,
    getClients,
    setClustersList,
    getClustersList,
    getCloudProvider,
    generateMetaCloudConfig,
    getMetaCloudConfig
}
