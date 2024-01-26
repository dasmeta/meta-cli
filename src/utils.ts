import os from 'os';
import fs from 'fs';
import { parse } from 'yaml';
import { Provider } from './Provider';
import { PROVIDER, GIT_PROVIDER, Account } from './types';
import AWSProvider from './AWSProvider';
import KubernetesProvider from './KubernetesProvider';
import GCPProvider from './GCPProvider';
import AzureProvider from './AzureProvider';

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
    tfAutoApply?: boolean;
    handlerVersion?: string;
    gitProvider: GIT_PROVIDER;
    gitOrg: string;
    gitRepo: string;
    rootDir?: string;
    targetDir?: string;
    yamlDir?: string;
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

function setAccounts(accounts: Account[]) {
    const metaDir = `${os.homedir()}/.meta`;

    if(!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir)
    }

    fs.writeFileSync(`${metaDir}/accounts.json`, JSON.stringify(accounts));
}

function getAccounts(): Account[]|boolean {
    if(!fs.existsSync(`${os.homedir}/.meta/accounts.json`)) {
        return false;
    }

    const data = fs.readFileSync(`${os.homedir}/.meta/accounts.json`, 'utf8');
    return JSON.parse(data) as Account[];
}

function getAccount(accountId: string): Account | false {
    const accounts = getAccounts() as Account[];
    const account = accounts.find(item => item.accountId === accountId);
    if(!account) {
        return false;
    }
    return account;
}

function getProvider(provider: PROVIDER): Provider {
    if(provider === PROVIDER.AWS) {
        return new AWSProvider();
    }
    if(provider === PROVIDER.KUBERNETES) {
        return new KubernetesProvider();
    }
    if(provider === PROVIDER.GCP) {
        return new GCPProvider();
    }
    if(provider === PROVIDER.AZURE) {
        return new AzureProvider();
    }

    throw new Error (`Unknown provider: ${provider}`);
}

function generateMetaCloudConfig(config: MetaConfig) {
    const metaCloudYaml = `terraform_cloud_org: ${config.tfCloudOrg}
terraform_cloud_workspace: ${config.tfCloudWorkspace}

git_provider: ${config.gitProvider}
git_org: ${config.tfCloudOrg}
git_repo: ${config.gitRepo}`;

    fs.writeFileSync(`metacloud.yaml`, metaCloudYaml);
}

function generateMetaCloudTF(config: MetaConfig) {

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
  version = "${config.handlerVersion || "~> v2.5.0"}"

  org   = var.tfc_org
  token = var.tfc_token

  rootdir   = "\${path.module}/${config.rootDir || "_terraform/"}" # should be default value
  targetdir = "\${path.module}/${config.targetDir || "_terraform"}" # should be default value
  yamldir   = "\${path.module}/${config.yamlDir || "."}"

  git_provider = var.git_provider
  git_org      = var.git_org
  git_repo     = var.git_repo
  git_token    = var.git_token

  auto_apply   = ${typeof config.tfAutoApply !== 'undefined' ? config.tfAutoApply : true}

  aws = {
    access_key_id     = var.access_key_id
    secret_access_key = var.secret_access_key
    session_token     = var.session_token
    security_token    = var.security_token
    region            = var.region
    default_region    = var.default_region
  }
}`;
    
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
        gitRepo: data['git_repo'],
        tfAutoApply: data['auto_apply'],
        yamlDir: data['yaml_dir'],
        rootDir: data['root_dir'],
        targetDir: data['target_dir'],
        handlerVersion: data['handler_version']
    }
}

export {
    setConfig,
    getConfig,
    setAccounts,
    getAccounts,
    getAccount,
    getProvider,
    generateMetaCloudConfig,
    generateMetaCloudTF,
    getMetaCloudConfig
}
