import { expect } from 'chai';

import {
  formatSetupsLabel,
  formatSetupLinkSummary,
  resolveSetupDriver,
} from '../src/setup-display';
import type { ParsedWorkspace } from '../src/yaml-validation';

describe('setup-display', () => {
  it('formats driver-specific setup labels', () => {
    expect(formatSetupsLabel('terramate')).to.equal('Setups (Stacks)');
    expect(formatSetupsLabel('terragrunt')).to.equal('Setups (Units)');
    expect(formatSetupsLabel('terraform-cloud')).to.equal('Setups (Workspaces)');
  });

  it('resolves driver from metacloud config', () => {
    expect(resolveSetupDriver({ driver: 'terramate' })).to.equal('terramate');
    expect(resolveSetupDriver(false)).to.equal('terraform-cloud');
  });

  it('includes inferred tier links in setup summaries', () => {
    const setup: ParsedWorkspace = {
      path: '2-products/azure/aks/central/setups/my',
      linkedWorkspaces: [],
      linkedReferences: [],
      raw: {},
    };
    const paths = new Set([
      '2-products/azure/aks/central/setups/my',
      '1-environments/azure/aks/central/cluster',
    ]);

    expect(formatSetupLinkSummary(setup, paths)).to.equal(' (links: 1-environments/azure/aks/central/cluster)');
  });
});
