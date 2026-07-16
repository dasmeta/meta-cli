import { expect } from 'chai';

import {
  buildBootstrapPlan,
  resolveBootstrapTarget,
} from '../src/backend-bootstrap';
import { formatPlan, formatStepCommand } from '../src/backend-bootstrap/runner';
import { MetaConfig } from '../src/utils';

describe('backend-bootstrap', () => {
  describe('resolveBootstrapTarget', () => {
    it('resolves terraform-cloud workspace target', () => {
      const target = resolveBootstrapTarget({
        driver: 'terraform-cloud',
        tfCloudOrg: 'dasmeta',
        tfCloudWorkspace: 'infrastructure',
      }, { token: 'test-token' });

      expect(target.kind).to.equal('terraform-cloud');
      if (target.kind === 'terraform-cloud') {
        expect(target.input.organization).to.equal('dasmeta');
        expect(target.input.workspace).to.equal('infrastructure');
        expect(target.input.token).to.equal('test-token');
      }
    });

    it('resolves s3 backend target from metacloud config', () => {
      const config: MetaConfig = {
        driver: 'terramate',
        terraformBackend: {
          name: 's3',
          configs: {
            bucket: 'my-tfstate',
            region: 'eu-central-1',
            key: 'terramate',
          },
        },
      };

      const target = resolveBootstrapTarget(config);
      expect(target.kind).to.equal('s3');
      if (target.kind === 's3') {
        expect(target.input.bucket).to.equal('my-tfstate');
        expect(target.input.region).to.equal('eu-central-1');
      }
    });

    it('resolves azurerm backend target from metacloud config', () => {
      const target = resolveBootstrapTarget({
        driver: 'terramate',
        terraformBackend: {
          name: 'azurerm',
          configs: {
            resource_group_name: 'tfstate-rg',
            storage_account_name: 'tfstateacct',
            container_name: 'tfstate',
            key: 'terramate',
          },
        },
      });

      expect(target.kind).to.equal('azurerm');
      if (target.kind === 'azurerm') {
        expect(target.input.storageAccountName).to.equal('tfstateacct');
      }
    });

    it('rejects unsupported backend types', () => {
      expect(() => resolveBootstrapTarget({
        driver: 'terramate',
        terraformBackend: {
          name: 'http',
          configs: { address: 'https://example.com/state' },
        },
      })).to.throw(/not supported/);
    });
  });

  describe('buildBootstrapPlan', () => {
    it('includes provider cli commands for s3', () => {
      const plan = buildBootstrapPlan({
        kind: 's3',
        input: { bucket: 'example-tfstate', region: 'eu-central-1' },
      });

      expect(plan.backend).to.equal('s3');
      expect(plan.steps.some(step => step.command === 'aws' && step.args.includes('create-bucket'))).to.equal(true);
    });

    it('includes az cli commands for azurerm', () => {
      const plan = buildBootstrapPlan({
        kind: 'azurerm',
        input: {
          resourceGroupName: 'rg',
          storageAccountName: 'acct',
          containerName: 'tfstate',
        },
      });

      expect(plan.steps.some(step => step.command === 'az' && step.args.includes('container'))).to.equal(true);
    });

    it('redacts terraform cloud token in formatted output', () => {
      const plan = buildBootstrapPlan({
        kind: 'terraform-cloud',
        input: {
          organization: 'org',
          workspace: 'ws',
          token: 'secret-token',
        },
      });

      const tokenStep = plan.steps[0];
      const rendered = formatStepCommand(tokenStep);
      expect(rendered).to.contain('<redacted>');
      expect(rendered).to.not.contain('secret-token');
      expect(formatPlan(plan)).to.contain('execution-mode=local');
    });
  });
});
