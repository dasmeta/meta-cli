import type { MetaDriver } from './utils';
import type { ParsedWorkspace } from './yaml-validation';
import { inferTierSetupClusterPath } from './yaml-validation';

export const SETUP_KIND_LABELS: Record<MetaDriver, string> = {
  'terramate': 'Stacks',
  'terragrunt': 'Units',
  'terraform-cloud': 'Workspaces',
};

export function formatSetupsLabel(driver: MetaDriver): string {
  return `Setups (${SETUP_KIND_LABELS[driver]})`;
}

export function resolveSetupDriver(config: { driver?: MetaDriver } | false): MetaDriver {
  if (config && config.driver) {
    return config.driver;
  }

  return 'terraform-cloud';
}

export function formatSetupLinkSummary(setup: ParsedWorkspace, workspacePaths: Set<string>): string {
  const inferred = inferTierSetupClusterPath(setup.path, workspacePaths);
  const links = [...new Set([
    ...setup.linkedWorkspaces,
    ...setup.linkedReferences,
    ...(inferred ? [inferred] : []),
  ])];

  return links.length > 0 ? ` (links: ${links.join(', ')})` : '';
}
