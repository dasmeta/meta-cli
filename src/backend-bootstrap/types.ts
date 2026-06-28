export type BootstrapAction = 'check' | 'create' | 'configure';

export type BootstrapStep = {
  action: BootstrapAction;
  description: string;
  command: string;
  args: string[];
  /** Mask sensitive values when printing the planned command. */
  redactArgs?: number[];
};

export type BootstrapPlan = {
  backend: string;
  summary: string;
  steps: BootstrapStep[];
};

export type S3BackendInput = {
  bucket: string;
  region: string;
  key?: string;
};

export type AzurermBackendInput = {
  resourceGroupName: string;
  storageAccountName: string;
  containerName: string;
  key?: string;
  location?: string;
};

export type GcsBackendInput = {
  bucket: string;
  prefix?: string;
  location?: string;
};

export type TerraformCloudBackendInput = {
  organization: string;
  workspace: string;
  token: string;
  terraformVersion?: string;
};
