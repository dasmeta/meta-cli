import os from 'os';
import fs from 'fs';
import path from 'path';
import { parse, stringify } from 'yaml';
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
    driver?: MetaDriver;
    tfCloudOrg?: string;
    tfCloudWorkspace?: string;
    tfAutoApply?: boolean;
    handlerVersion?: string;
    gitProvider?: GIT_PROVIDER;
    gitOrg?: string;
    gitRepo?: string;
    rootDir?: string;
    targetDir?: string;
    yamlDir?: string;
    terraformBackend?: TerraformBackendConfig;
    linkingMode?: string;
    mockInputsEnabled?: boolean;
    stackIdPrefix?: string | null;
}

export type MetaDriver = 'terraform-cloud' | 'terramate' | 'terragrunt';

export type TerraformBackendConfig = {
    name: string;
    configs?: {[key: string]: unknown};
}

function metaConfigToYamlData(config: MetaConfig): {[key: string]: unknown} {
    const driver = config.driver || 'terraform-cloud';
    const data: {[key: string]: unknown} = {
        driver,
    };

    if (driver === 'terraform-cloud') {
        data['terraform_cloud_org'] = config.tfCloudOrg;
        data['terraform_cloud_workspace'] = config.tfCloudWorkspace;
        if (config.gitProvider) {
            data['git_provider'] = config.gitProvider;
        }
        if (config.gitOrg) {
            data['git_org'] = config.gitOrg;
        }
        if (config.gitRepo) {
            data['git_repo'] = config.gitRepo;
        }
    }

    if (typeof config.tfAutoApply !== 'undefined') {
        data['auto_apply'] = config.tfAutoApply;
    }
    if (config.yamlDir) {
        data['yaml_dir'] = config.yamlDir;
    }
    if (config.rootDir) {
        data['root_dir'] = config.rootDir;
    }
    if (config.targetDir) {
        data['target_dir'] = config.targetDir;
    }
    if (config.handlerVersion) {
        data['handler_version'] = config.handlerVersion;
    }
    if (config.terraformBackend) {
        data['terraform_backend'] = config.terraformBackend;
    }
    if (config.linkingMode) {
        data['linking_mode'] = config.linkingMode;
    }
    if (typeof config.mockInputsEnabled !== 'undefined') {
        data['mock_inputs_enabled'] = config.mockInputsEnabled;
    }
    if (typeof config.stackIdPrefix !== 'undefined') {
        data['stack_id_prefix'] = config.stackIdPrefix;
    }

    return data;
}

function normalizeMetaCloudConfig(data: {[key: string]: any}): MetaConfig {
    return {
        driver: (data['driver'] || 'terraform-cloud') as MetaDriver,
        tfCloudOrg: data['terraform_cloud_org'],
        tfCloudWorkspace: data['terraform_cloud_workspace'],
        gitProvider: data['git_provider'],
        gitOrg: data['git_org'],
        gitRepo: data['git_repo'],
        tfAutoApply: data['auto_apply'],
        yamlDir: data['yaml_dir'],
        rootDir: data['root_dir'],
        targetDir: data['target_dir'],
        handlerVersion: data['handler_version'],
        terraformBackend: data['terraform_backend'],
        linkingMode: data['linking_mode'],
        mockInputsEnabled: data['mock_inputs_enabled'],
        stackIdPrefix: data['stack_id_prefix'],
    };
}

function buildMetaCloudConfigContent(config: MetaConfig): string {
    return stringify(metaConfigToYamlData(config));
}

function pathModuleDir(dir: string, trailingSlash = false): string {
    const cleaned = dir.replace(/\/+$/, '');
    const suffix = trailingSlash && cleaned !== '.' ? '/' : '';
    return `\${path.module}/${cleaned}${suffix}`;
}

function renderRootTerraformBackendBlock(config?: TerraformBackendConfig): string {
    if (!config?.name) {
        return '';
    }

    const lines = [
        'terraform {',
        `  backend "${config.name}" {`,
    ];

    if (config.configs && Object.keys(config.configs).length > 0) {
        for (const [key, value] of Object.entries(config.configs)) {
            if (typeof value === 'boolean') {
                lines.push(`    ${key} = ${value}`);
            } else if (typeof value === 'number') {
                lines.push(`    ${key} = ${value}`);
            } else {
                lines.push(`    ${key} = ${JSON.stringify(value)}`);
            }
        }
    }

    lines.push('  }', '}', '');
    return `${lines.join('\n')}\n`;
}

function renderBackendConfig(config?: TerraformBackendConfig): string {
    if (!config) {
        return '';
    }

    const lines = [
        '  terraform_backend = {',
        `    name = "${config.name}"`,
    ];

    if (config.configs && Object.keys(config.configs).length > 0) {
        lines.push('    configs = {');
        for (const [key, value] of Object.entries(config.configs)) {
            lines.push(`      ${key} = ${JSON.stringify(value)}`);
        }
        lines.push('    }');
    }

    lines.push('  }');
    return `${lines.join('\n')}\n`;
}

function generateTerraformCloudTF(config: MetaConfig): string {
    const rootDir = pathModuleDir(config.rootDir || '_terraform', true);
    const targetDir = pathModuleDir(config.targetDir || '_terraform');
    const yamlDir = pathModuleDir(config.yamlDir || '.');

    return `terraform {
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

  rootdir   = "${rootDir}"
  targetdir = "${targetDir}"
  yamldir   = "${yamlDir}"

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
}

function generateTerramateTF(config: MetaConfig): string {
    return `${renderRootTerraformBackendBlock(config.terraformBackend)}module "metacloud" {
  source  = "dasmeta/cli/terramate"
  version = "${config.handlerVersion || "~> 1.0.0"}"

  yamldir   = "${pathModuleDir(config.yamlDir || ".")}"
  targetdir = "${pathModuleDir(config.targetDir || "_terraform")}"
${renderBackendConfig(config.terraformBackend)}${config.linkingMode ? `  linking_mode = "${config.linkingMode}"\n` : ''}${typeof config.mockInputsEnabled !== 'undefined' ? `  mock_inputs_enabled = ${config.mockInputsEnabled}\n` : ''}${typeof config.stackIdPrefix !== 'undefined' && config.stackIdPrefix !== null ? `  stack_id_prefix = "${config.stackIdPrefix}"\n` : ''}}`;
}

function generateTerragruntTF(config: MetaConfig): string {
    return `${renderRootTerraformBackendBlock(config.terraformBackend)}module "metacloud" {
  source  = "dasmeta/cli/terragrunt"
  version = "${config.handlerVersion || "~> 1.0.0"}"

  yamldir   = "${pathModuleDir(config.yamlDir || ".")}"
  targetdir = "${pathModuleDir(config.targetDir || "_terragrunt")}"
${renderBackendConfig(config.terraformBackend)}}`;
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
    fs.writeFileSync(`metacloud.yaml`, buildMetaCloudConfigContent(config));
}

function generateMetaCloudTF(config: MetaConfig) {
  const driver = config.driver || 'terraform-cloud';
  const metaCloudTf = driver === 'terramate'
    ? generateTerramateTF(config)
    : driver === 'terragrunt'
      ? generateTerragruntTF(config)
      : generateTerraformCloudTF(config);

  fs.writeFileSync(`_metacloud.tf`, metaCloudTf);
}

function getMetaCloudConfig(cwd: string = process.cwd()): MetaConfig|false {
    const configPath = path.join(cwd, 'metacloud.yaml');

    if(!fs.existsSync(configPath)) {
        return false;
    }

    const yaml = fs.readFileSync(configPath, 'utf-8');
    const data = parse(yaml);

    return normalizeMetaCloudConfig(data);
}

export {
    setConfig,
    getConfig,
    setAccounts,
    getAccounts,
    getAccount,
    getProvider,
    buildMetaCloudConfigContent,
    generateTerraformCloudTF,
    generateTerramateTF,
    generateTerragruntTF,
    normalizeMetaCloudConfig,
    generateMetaCloudConfig,
    generateMetaCloudTF,
    getMetaCloudConfig
}
