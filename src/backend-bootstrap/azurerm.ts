import { AzurermBackendInput, BootstrapPlan } from './types';

export function buildAzurermPlan(input: AzurermBackendInput): BootstrapPlan {
  const location = input.location || 'westeurope';

  return {
    backend: 'azurerm',
    summary: [
      `Ensure Azure resource group "${input.resourceGroupName}" (${location}),`,
      `storage account "${input.storageAccountName}", and container "${input.containerName}" exist.`,
    ].join(' '),
    steps: [
      {
        action: 'check',
        description: 'Verify Azure CLI login',
        command: 'az',
        args: ['account', 'show'],
      },
      {
        action: 'check',
        description: `Check resource group "${input.resourceGroupName}"`,
        command: 'az',
        args: ['group', 'exists', '--name', input.resourceGroupName],
      },
      {
        action: 'create',
        description: `Create resource group "${input.resourceGroupName}"`,
        command: 'az',
        args: ['group', 'create', '--name', input.resourceGroupName, '--location', location],
      },
      {
        action: 'check',
        description: `Check storage account "${input.storageAccountName}"`,
        command: 'az',
        args: ['storage', 'account', 'show', '--name', input.storageAccountName, '--resource-group', input.resourceGroupName],
      },
      {
        action: 'create',
        description: `Create storage account "${input.storageAccountName}"`,
        command: 'az',
        args: [
          'storage', 'account', 'create',
          '--name', input.storageAccountName,
          '--resource-group', input.resourceGroupName,
          '--location', location,
          '--sku', 'Standard_LRS',
          '--kind', 'StorageV2',
          '--min-tls-version', 'TLS1_2',
          '--allow-blob-public-access', 'false',
        ],
      },
      {
        action: 'create',
        description: `Create blob container "${input.containerName}"`,
        command: 'az',
        args: [
          'storage', 'container', 'create',
          '--name', input.containerName,
          '--account-name', input.storageAccountName,
          '--auth-mode', 'login',
        ],
      },
    ],
  };
}

export async function provisionAzurerm(
  input: AzurermBackendInput,
  runStep: typeof import('./runner').runStep,
  log: (message: string, ...args: unknown[]) => void,
): Promise<void> {
  const plan = buildAzurermPlan(input);
  const [
    accountStep,
    groupExistsStep,
    groupCreateStep,
    accountShowStep,
    accountCreateStep,
    containerCreateStep,
  ] = plan.steps;

  await runStep(accountStep, log);

  const groupExistsResult = await runStep(groupExistsStep, log);
  const groupExists = groupExistsResult.stdout.trim() === 'true';

  if (!groupExists) {
    await runStep(groupCreateStep, log);
  } else {
    log(`Resource group "${input.resourceGroupName}" already exists — skipping creation.`);
  }

  const accountShowResult = await runStep(accountShowStep, log);
  const accountExists = accountShowResult.exitCode === 0;

  if (!accountExists) {
    await runStep(accountCreateStep, log);
  } else {
    log(`Storage account "${input.storageAccountName}" already exists — skipping creation.`);
  }

  const containerResult = await runStep(containerCreateStep, log);
  if (containerResult.exitCode !== 0 && /already exists/i.test(containerResult.stderr)) {
    log(`Container "${input.containerName}" already exists — skipping creation.`);
    return;
  }

  if (containerResult.exitCode !== 0) {
    throw new Error(`Failed to create container "${input.containerName}".`);
  }
}
