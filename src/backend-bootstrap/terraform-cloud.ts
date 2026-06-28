import axios from 'axios';

import { BootstrapPlan, TerraformCloudBackendInput } from './types';

export function buildTerraformCloudPlan(input: TerraformCloudBackendInput): BootstrapPlan {
  const apiBase = 'https://app.terraform.io/api/v2';
  const workspaceUrl = `${apiBase}/organizations/${input.organization}/workspaces/${input.workspace}`;

  return {
    backend: 'terraform-cloud',
    summary: `Ensure Terraform Cloud workspace "${input.organization}/${input.workspace}" exists with local execution mode.`,
    steps: [
      {
        action: 'check',
        description: 'Verify Terraform Cloud API token',
        command: 'curl',
        args: [
          '--silent', '--show-error', '--fail',
          '--header', `Authorization: Bearer ${input.token}`,
          `${apiBase}/account/details`,
        ],
        redactArgs: [4],
      },
      {
        action: 'check',
        description: `Check whether workspace "${input.workspace}" exists`,
        command: 'curl',
        args: [
          '--silent', '--show-error',
          '--header', `Authorization: Bearer ${input.token}`,
          '--write-out', '%{http_code}',
          '--output', '/dev/null',
          workspaceUrl,
        ],
        redactArgs: [3],
      },
      {
        action: 'create',
        description: `Create workspace "${input.workspace}" (execution-mode=local)`,
        command: 'curl',
        args: [
          '--silent', '--show-error', '--fail',
          '--header', `Authorization: Bearer ${input.token}`,
          '--header', 'Content-Type: application/vnd.api+json',
          '--request', 'POST',
          '--data', JSON.stringify({
            data: {
              type: 'workspaces',
              attributes: {
                name: input.workspace,
                'execution-mode': 'local',
                'terraform-version': input.terraformVersion || '1.9.0',
              },
            },
          }),
          `${apiBase}/organizations/${input.organization}/workspaces`,
        ],
        redactArgs: [4],
      },
    ],
  };
}

async function verifyToken(token: string): Promise<void> {
  await axios.get('https://app.terraform.io/api/v2/account/details', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.api+json',
    },
  });
}

async function workspaceExists(input: TerraformCloudBackendInput): Promise<boolean> {
  const url = `https://app.terraform.io/api/v2/organizations/${input.organization}/workspaces/${input.workspace}`;

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/vnd.api+json',
    },
    validateStatus: (status) => status === 200 || status === 404,
  });

  return response.status === 200;
}

async function createWorkspace(input: TerraformCloudBackendInput): Promise<void> {
  const url = `https://app.terraform.io/api/v2/organizations/${input.organization}/workspaces`;

  await axios.post(url, {
    data: {
      type: 'workspaces',
      attributes: {
        name: input.workspace,
        'execution-mode': 'local',
        'terraform-version': input.terraformVersion || '1.9.0',
      },
    },
  }, {
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/vnd.api+json',
    },
  });
}

export async function provisionTerraformCloud(
  input: TerraformCloudBackendInput,
  log: (message: string, ...args: unknown[]) => void,
): Promise<void> {
  log('Verifying Terraform Cloud API token...');
  await verifyToken(input.token);

  log(`Checking workspace "${input.organization}/${input.workspace}"...`);
  const exists = await workspaceExists(input);

  if (exists) {
    log(`Workspace "${input.workspace}" already exists — skipping creation.`);
    return;
  }

  log(`Creating workspace "${input.workspace}" with local execution mode...`);
  await createWorkspace(input);
}
