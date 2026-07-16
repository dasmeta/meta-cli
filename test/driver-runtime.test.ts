import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect } from 'chai';

import { GIT_PROVIDER } from '../src/types';
import {
  buildExecutionPlan,
  detectSetupDirs,
  errorNeedsInitRetry,
  formatCommandInvocation,
  isTerraformCloudUnsupportedAction,
  normalizeSetupSelectors,
  resolveSetupDirs,
} from '../src/driver-runtime';
import type { MetaConfig } from '../src/utils';

describe('driver runtime', () => {
  describe('normalizeSetupSelectors', () => {
    it('supports repeated and comma separated selectors', () => {
      expect(normalizeSetupSelectors(['group-0/module-a,group-2/dns-zone', 'module-c'])).to.deep.equal([
        'group-0/module-a',
        'group-2/dns-zone',
        'module-c',
      ]);
    });
  });

  describe('setup detection and matching', () => {
    let tmpDir = '';

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-driver-runtime-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    });

    it('detects terramate stacks and resolves exact relative paths', () => {
      const rootDir = path.join(tmpDir, '_terraform');
      fs.mkdirSync(path.join(rootDir, 'group-0', 'module-a'), { recursive: true });
      fs.mkdirSync(path.join(rootDir, 'group-1', 'module-b'), { recursive: true });
      fs.writeFileSync(path.join(rootDir, 'group-0', 'module-a', 'stack.tm.hcl'), '');
      fs.writeFileSync(path.join(rootDir, 'group-1', 'module-b', 'stack.tm.hcl'), '');

      const setupDirs = detectSetupDirs(rootDir, 'terramate');
      const selected = resolveSetupDirs(rootDir, setupDirs, ['group-0/module-a']);

      expect(selected).to.deep.equal([path.join(rootDir, 'group-0', 'module-a')]);
    });

    it('fails on ambiguous basename matches', () => {
      const rootDir = path.join(tmpDir, '_terraform');
      fs.mkdirSync(path.join(rootDir, 'group-0', 'module-a'), { recursive: true });
      fs.mkdirSync(path.join(rootDir, 'group-1', 'module-a'), { recursive: true });
      fs.writeFileSync(path.join(rootDir, 'group-0', 'module-a', 'stack.tm.hcl'), '');
      fs.writeFileSync(path.join(rootDir, 'group-1', 'module-a', 'stack.tm.hcl'), '');

      const setupDirs = detectSetupDirs(rootDir, 'terramate');

      expect(() => resolveSetupDirs(rootDir, setupDirs, ['module-a'])).to.throw('Ambiguous setup selector "module-a"');
    });

    it('fails when no setup matches', () => {
      const rootDir = path.join(tmpDir, '_terraform');
      fs.mkdirSync(path.join(rootDir, 'group-0', 'module-a'), { recursive: true });
      fs.writeFileSync(path.join(rootDir, 'group-0', 'module-a', 'stack.tm.hcl'), '');

      const setupDirs = detectSetupDirs(rootDir, 'terramate');

      expect(() => resolveSetupDirs(rootDir, setupDirs, ['missing-setup'])).to.throw('No setup matched selector "missing-setup"');
    });
  });

  describe('execution plan building', () => {
    const terramateConfig: MetaConfig = {
      driver: 'terramate',
      gitOrg: 'dasmeta',
      gitProvider: GIT_PROVIDER.GITHUB,
      gitRepo: 'infra',
      targetDir: '_terraform',
    };

    const terragruntConfig: MetaConfig = {
      driver: 'terragrunt',
      gitOrg: 'dasmeta',
      gitProvider: GIT_PROVIDER.GITHUB,
      gitRepo: 'infra',
      targetDir: '_terragrunt',
    };

    const terraformCloudConfig: MetaConfig = {
      gitOrg: 'dasmeta',
      gitProvider: GIT_PROVIDER.GITHUB,
      gitRepo: 'infra',
      tfCloudOrg: 'dasmeta',
      tfCloudWorkspace: 'infrastructure',
    };

    it('builds terramate plan with sharing defaults', () => {
      const plan = buildExecutionPlan({
        action: 'plan',
        config: terramateConfig,
        cwd: '/repo',
        setupDirs: [],
        extraArgs: ['-lock-timeout=5m'],
      });

      expect(plan.requiredTools).to.deep.equal(['terramate', 'terraform']);
      expect(plan.commands).to.have.length(2);
      expect(plan.commands[0].binary).to.equal('terramate');
      expect(plan.commands[0].args).to.deep.equal([
        '-C',
        '/repo/_terraform',
        'run',
        '--enable-sharing',
        '--mock-on-fail',
        '--disable-safeguards=git-untracked,git-uncommitted,git-out-of-sync',
        '--',
        'terraform',
        'plan',
        '-lock-timeout=5m',
      ]);
      expect(plan.commands[1]).to.deep.equal({
        args: ['-C', '/repo/_terraform', 'run', '--', 'terraform', 'init'],
        binary: 'terramate',
      });
    });

    it('builds terramate destroy with reverse and without mock-on-fail', () => {
      const plan = buildExecutionPlan({
        action: 'destroy',
        config: terramateConfig,
        cwd: '/repo',
        setupDirs: [],
        extraArgs: [],
      });

      expect(plan.commands[0].args).to.include('--reverse');
      expect(plan.commands[0].args).to.not.include('--mock-on-fail');
      expect(plan.commands[0].args).to.not.include('-auto-approve');
    });

    it('builds terragrunt apply for all units without auto-approve', () => {
      const plan = buildExecutionPlan({
        action: 'apply',
        config: terragruntConfig,
        cwd: '/repo',
        setupDirs: [],
        extraArgs: [],
      });

      expect(plan.requiredTools).to.deep.equal(['terragrunt']);
      expect(plan.commands[0].binary).to.equal('terragrunt');
      expect(plan.commands[0].args).to.deep.equal([
        '--working-dir',
        '/repo/_terragrunt',
        'run',
        '--all',
        '--no-auto-approve',
        '--',
        'apply',
      ]);
    });

    it('builds terraform-cloud validate as per-setup init and validate', () => {
      const setupDir = '/repo/_terraform/group-0/module-a';
      const plan = buildExecutionPlan({
        action: 'validate',
        config: terraformCloudConfig,
        cwd: '/repo',
        setupDirs: [setupDir],
        extraArgs: [],
      });

      expect(plan.requiredTools).to.deep.equal(['terraform']);
      expect(plan.commands).to.have.length(2);
      expect(plan.commands[0]).to.deep.equal({
        args: ['validate'],
        binary: 'terraform',
        cwd: setupDir,
      });
      expect(plan.commands[1]).to.deep.equal({
        args: ['init', '-backend=false'],
        binary: 'terraform',
        cwd: setupDir,
      });
    });
  });

  describe('terraform-cloud action support', () => {
    const terraformCloudConfig: MetaConfig = {
      gitOrg: 'dasmeta',
      gitProvider: GIT_PROVIDER.GITHUB,
      gitRepo: 'infra',
      tfCloudOrg: 'dasmeta',
      tfCloudWorkspace: 'infrastructure',
    };

    it('flags plan, apply, and destroy as unsupported for terraform-cloud', () => {
      expect(isTerraformCloudUnsupportedAction('plan', terraformCloudConfig)).to.be.true;
      expect(isTerraformCloudUnsupportedAction('apply', terraformCloudConfig)).to.be.true;
      expect(isTerraformCloudUnsupportedAction('destroy', terraformCloudConfig)).to.be.true;
      expect(isTerraformCloudUnsupportedAction('validate', terraformCloudConfig)).to.be.false;
    });

    it('does not flag other drivers as unsupported', () => {
      expect(isTerraformCloudUnsupportedAction('plan', { driver: 'terramate', gitOrg: 'dasmeta', gitProvider: GIT_PROVIDER.GITHUB, gitRepo: 'infra' })).to.be.false;
      expect(isTerraformCloudUnsupportedAction('apply', { driver: 'terragrunt', gitOrg: 'dasmeta', gitProvider: GIT_PROVIDER.GITHUB, gitRepo: 'infra' })).to.be.false;
    });
  });

  describe('command display', () => {
    it('formats terraform commands with working directory', () => {
      expect(formatCommandInvocation({
        binary: 'terraform',
        args: ['plan', '-lock-timeout=5m'],
        cwd: '/repo/_terraform/group-0/module-a',
      })).to.equal("(cd /repo/_terraform/group-0/module-a && terraform plan -lock-timeout=5m)");
    });

    it('quotes arguments that contain spaces', () => {
      expect(formatCommandInvocation({
        binary: 'terraform',
        args: ['plan', '-var=my value'],
        cwd: '/repo with spaces/_terraform',
      })).to.equal("(cd '/repo with spaces/_terraform' && terraform plan '-var=my value')");
    });

    it('formats commands without working directory', () => {
      expect(formatCommandInvocation({
        binary: 'terragrunt',
        args: ['--working-dir', '/repo/_terragrunt', 'run', '--all', '--', 'plan'],
      })).to.equal('terragrunt --working-dir /repo/_terragrunt run --all -- plan');
    });
  });

  describe('lazy init detection', () => {
    it('detects terraform init-required errors', () => {
      expect(errorNeedsInitRetry('Error: Module not installed. Run "terraform init" to install all modules required by this configuration.')).to.equal(true);
      expect(errorNeedsInitRetry('Error: Inconsistent dependency lock file')).to.equal(true);
    });

    it('detects terragrunt and terramate init-required errors via terraform message', () => {
      expect(errorNeedsInitRetry('Initializing the backend...\nError: Backend initialization required, please run "terraform init"')).to.equal(true);
    });

    it('does not match unrelated failures', () => {
      expect(errorNeedsInitRetry('Error: Unsupported argument')).to.equal(false);
      expect(errorNeedsInitRetry('HostedZoneNotEmpty')).to.equal(false);
    });
  });
});
