import { MetaConfig, MetaDriver, getMetaCloudConfig } from '../utils';
import { buildAzurermPlan, provisionAzurerm } from './azurerm';
import { buildGcsPlan, provisionGcs } from './gcs';
import { buildS3Plan, provisionS3 } from './s3';
import { buildTerraformCloudPlan, provisionTerraformCloud } from './terraform-cloud';
import { confirmPlan, formatPlan, runStep } from './runner';
import {
  AzurermBackendInput,
  BootstrapPlan,
  GcsBackendInput,
  S3BackendInput,
  TerraformCloudBackendInput,
} from './types';

export type BootstrapBackendOptions = {
  skipConfirm?: boolean;
  region?: string;
  location?: string;
  token?: string;
  terraformVersion?: string;
};

export type ResolvedBootstrapTarget =
  | { kind: 's3'; input: S3BackendInput }
  | { kind: 'azurerm'; input: AzurermBackendInput }
  | { kind: 'gcs'; input: GcsBackendInput }
  | { kind: 'terraform-cloud'; input: TerraformCloudBackendInput };

function requireConfigValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing ${label}. Set it in metacloud.yaml or pass the appropriate flag.`);
  }

  return value.trim();
}

export function resolveBootstrapTarget(
  config: MetaConfig,
  options: BootstrapBackendOptions = {},
): ResolvedBootstrapTarget {
  const driver = (config.driver || 'terraform-cloud') as MetaDriver;

  if (driver === 'terraform-cloud') {
    const token = options.token
      || process.env.TF_TOKEN_app_terraform_io
      || process.env.TFE_TOKEN
      || process.env.TF_TOKEN;

    if (!token) {
      throw new Error('Terraform Cloud token not found. Set TF_TOKEN_app_terraform_io / TFE_TOKEN or pass --token.');
    }

    return {
      kind: 'terraform-cloud',
      input: {
        organization: requireConfigValue(config.tfCloudOrg, 'terraform_cloud_org'),
        workspace: requireConfigValue(config.tfCloudWorkspace, 'terraform_cloud_workspace'),
        token,
        terraformVersion: options.terraformVersion,
      },
    };
  }

  const backendName = requireConfigValue(config.terraformBackend?.name, 'terraform_backend.name');
  const backendConfigs = config.terraformBackend?.configs || {};

  if (backendName === 's3') {
    return {
      kind: 's3',
      input: {
        bucket: requireConfigValue(backendConfigs.bucket, 'terraform_backend.configs.bucket'),
        region: options.region || requireConfigValue(backendConfigs.region, 'terraform_backend.configs.region'),
        key: typeof backendConfigs.key === 'string' ? backendConfigs.key : undefined,
      },
    };
  }

  if (backendName === 'azurerm') {
    return {
      kind: 'azurerm',
      input: {
        resourceGroupName: requireConfigValue(backendConfigs.resource_group_name, 'terraform_backend.configs.resource_group_name'),
        storageAccountName: requireConfigValue(backendConfigs.storage_account_name, 'terraform_backend.configs.storage_account_name'),
        containerName: requireConfigValue(backendConfigs.container_name, 'terraform_backend.configs.container_name'),
        key: typeof backendConfigs.key === 'string' ? backendConfigs.key : undefined,
        location: options.location,
      },
    };
  }

  if (backendName === 'gcs') {
    return {
      kind: 'gcs',
      input: {
        bucket: requireConfigValue(backendConfigs.bucket, 'terraform_backend.configs.bucket'),
        prefix: typeof backendConfigs.prefix === 'string' ? backendConfigs.prefix : undefined,
        location: options.location,
      },
    };
  }

  throw new Error(`Backend "${backendName}" is not supported by tf-bootstrap-backend. Supported: s3, azurerm, gcs, terraform-cloud.`);
}

export function buildBootstrapPlan(target: ResolvedBootstrapTarget): BootstrapPlan {
  switch (target.kind) {
  case 's3':
    return buildS3Plan(target.input);
  case 'azurerm':
    return buildAzurermPlan(target.input);
  case 'gcs':
    return buildGcsPlan(target.input);
  case 'terraform-cloud':
    return buildTerraformCloudPlan(target.input);
  default:
    throw new Error('Unsupported bootstrap target.');
  }
}

export async function bootstrapBackendFromConfig(
  config: MetaConfig,
  log: (message: string, ...args: unknown[]) => void,
  options: BootstrapBackendOptions = {},
): Promise<void> {
  const target = resolveBootstrapTarget(config, options);
  const plan = buildBootstrapPlan(target);

  log(formatPlan(plan));
  log('');

  const confirmed = await confirmPlan(Boolean(options.skipConfirm));
  if (!confirmed) {
    log('Aborted. No backend resources were created.');
    return;
  }

  log('Creating backend resources...');
  log('');

  switch (target.kind) {
  case 's3':
    await provisionS3(target.input, runStep, log);
    break;
  case 'azurerm':
    await provisionAzurerm(target.input, runStep, log);
    break;
  case 'gcs':
    await provisionGcs(target.input, runStep, log);
    break;
  case 'terraform-cloud':
    await provisionTerraformCloud(target.input, log);
    break;
  default:
    throw new Error('Unsupported bootstrap target.');
  }

  log('');
  log('Backend provisioning completed.');
}

export function loadMetaCloudConfigFromDir(dir: string): MetaConfig {
  const config = getMetaCloudConfig(dir);

  if (!config) {
    throw new Error(`metacloud.yaml not found in ${dir}`);
  }

  return config;
}
