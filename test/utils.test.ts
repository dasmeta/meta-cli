import { expect } from 'chai';

import {
  buildMetaCloudConfigContent,
  generateTerraformCloudTF,
  generateTerragruntTF,
  generateTerramateTF,
  normalizeMetaCloudConfig,
} from '../src/utils';
import { GIT_PROVIDER } from '../src/types';

describe('utils', () => {
  describe('normalizeMetaCloudConfig', () => {
    it('defaults missing driver to terraform-cloud', () => {
      const config = normalizeMetaCloudConfig({
        terraform_cloud_org: 'dasmeta',
        terraform_cloud_workspace: 'infrastructure',
        git_provider: 'github',
        git_org: 'dasmeta',
        git_repo: 'infra',
      });

      expect(config.driver).to.equal('terraform-cloud');
      expect(config.tfCloudOrg).to.equal('dasmeta');
      expect(config.tfCloudWorkspace).to.equal('infrastructure');
      expect(config.gitProvider).to.equal('github');
      expect(config.gitBranch).to.equal(undefined);
      expect(config.gitEnabled).to.equal(undefined);
      expect(config.aws).to.equal(undefined);
      expect(config.tfeTokenVariableSet).to.equal(undefined);
    });

    it('reads terraform cloud git settings', () => {
      const config = normalizeMetaCloudConfig({
        terraform_cloud_org: 'dasmeta',
        git_branch: 'release',
        git_enabled: false,
      });

      expect(config.gitBranch).to.equal('release');
      expect(config.gitEnabled).to.equal(false);
    });

    it('reads variable set settings', () => {
      const config = normalizeMetaCloudConfig({
        terraform_cloud_org: 'dasmeta',
        terraform_cloud_workspace: 'infrastructure',
        aws: { enabled: false, variable_set_name: 'aws_credentials' },
        tfe_token_variable_set: { enabled: false, name: 'tfe-token' },
      });

      expect(config.aws).to.deep.equal({ enabled: false, variableSetName: 'aws_credentials' });
      expect(config.tfeTokenVariableSet).to.deep.equal({ enabled: false, name: 'tfe-token' });
    });

    it('reads the vscode yaml schema opt-in', () => {
      expect(normalizeMetaCloudConfig({ driver: 'terramate' }).vscodeYamlSchema).to.equal(undefined);
      expect(normalizeMetaCloudConfig({ driver: 'terramate', vscode_yaml_schema: true }).vscodeYamlSchema).to.equal(true);
      expect(normalizeMetaCloudConfig({ driver: 'terramate', vscode_yaml_schema: false }).vscodeYamlSchema).to.equal(false);
    });

    it('ignores empty variable set settings', () => {
      const config = normalizeMetaCloudConfig({
        terraform_cloud_org: 'dasmeta',
        aws: null,
        tfe_token_variable_set: {},
      });

      expect(config.aws).to.equal(undefined);
      expect(config.tfeTokenVariableSet).to.equal(undefined);
    });
  });

  describe('buildMetaCloudConfigContent', () => {
    it('renders terraform cloud config with default driver', () => {
      const content = buildMetaCloudConfigContent({
        tfCloudOrg: 'dasmeta',
        tfCloudWorkspace: 'infrastructure',
        gitProvider: GIT_PROVIDER.GITHUB,
        gitOrg: 'dasmeta',
        gitRepo: 'infra',
      });

      expect(content).to.contain('driver: terraform-cloud');
      expect(content).to.contain('terraform_cloud_org: dasmeta');
      expect(content).to.contain('terraform_cloud_workspace: infrastructure');
      expect(content).to.contain('git_org: dasmeta');
      expect(content).to.not.contain('terraform_backend:');
      expect(content).to.not.contain('aws:');
      expect(content).to.not.contain('tfe_token_variable_set:');
      expect(content).to.not.contain('vscode_yaml_schema:');
      expect(content).to.not.contain('git_branch:');
      expect(content).to.not.contain('git_enabled:');
    });

    it('renders terraform cloud git settings', () => {
      const content = buildMetaCloudConfigContent({
        tfCloudOrg: 'dasmeta',
        tfCloudWorkspace: 'infrastructure',
        gitProvider: GIT_PROVIDER.GITHUB,
        gitOrg: 'dasmeta',
        gitRepo: 'infra',
        gitBranch: 'release',
        gitEnabled: false,
      });

      expect(content).to.contain('git_branch: release');
      expect(content).to.contain('git_enabled: false');
    });

    it('renders the vscode yaml schema opt-in when set', () => {
      const content = buildMetaCloudConfigContent({
        driver: 'terramate',
        vscodeYamlSchema: true,
      });

      expect(content).to.contain('vscode_yaml_schema: true');
    });

    it('renders variable set settings', () => {
      const content = buildMetaCloudConfigContent({
        tfCloudOrg: 'dasmeta',
        tfCloudWorkspace: 'infrastructure',
        aws: { enabled: false, variableSetName: 'aws_credentials' },
        tfeTokenVariableSet: { enabled: false, name: 'tfe-token' },
      });

      expect(content).to.contain('aws:');
      expect(content).to.contain('enabled: false');
      expect(content).to.contain('variable_set_name: aws_credentials');
      expect(content).to.contain('tfe_token_variable_set:');
      expect(content).to.contain('name: tfe-token');
    });

    it('renders terramate config with backend and linking settings', () => {
      const content = buildMetaCloudConfigContent({
        driver: 'terramate',
        terraformBackend: {
          name: 's3',
          configs: {
            bucket: 'example-state',
            region: 'eu-central-1',
            key: 'terramate',
          },
        },
        linkingMode: 'terramate_outputs_sharing',
        mockInputsEnabled: true,
        stackIdPrefix: 'example',
      });

      expect(content).to.contain('driver: terramate');
      expect(content).to.not.contain('git_org:');
      expect(content).to.not.contain('git_provider:');
      expect(content).to.contain('terraform_backend:');
      expect(content).to.contain('name: s3');
      expect(content).to.contain('bucket: example-state');
      expect(content).to.contain('linking_mode: terramate_outputs_sharing');
      expect(content).to.contain('mock_inputs_enabled: true');
      expect(content).to.contain('stack_id_prefix: example');
      expect(content).to.not.contain('terraform_cloud_org:');
    });
  });

  describe('driver tf generation', () => {
    it('renders terraform cloud module', () => {
      const content = generateTerraformCloudTF({
        driver: 'terraform-cloud',
        tfCloudOrg: 'dasmeta',
        tfCloudWorkspace: 'infrastructure',
        gitProvider: GIT_PROVIDER.GITHUB,
        gitOrg: 'dasmeta',
        gitRepo: 'infra',
      });

      expect(content).to.contain('source  = "dasmeta/cloud/tfe"');
      expect(content).to.contain('organization = "dasmeta"');
      expect(content).to.contain('workspaces { name = "infrastructure" }');
      expect(content).to.contain('rootdir   = "${path.module}/_terraform/"');
      expect(content).to.contain('targetdir = "${path.module}/_terraform"');
      expect(content).to.contain('yamldir   = "${path.module}/."');
      expect(content).to.contain('    access_key_id     = var.access_key_id');
      expect(content).to.not.contain('enabled');
      expect(content).to.not.contain('tfe_token_variable_set');
      expect(content).to.not.contain('variable_set_name');
      expect(content).to.not.contain('git_branch');
      expect(content).to.not.contain('git_enabled');
    });

    it('passes terraform cloud git settings to the module', () => {
      const content = generateTerraformCloudTF({
        driver: 'terraform-cloud',
        tfCloudOrg: 'dasmeta',
        tfCloudWorkspace: 'infrastructure',
        gitProvider: GIT_PROVIDER.GITHUB,
        gitOrg: 'dasmeta',
        gitRepo: 'infra',
        gitBranch: 'release',
        gitEnabled: false,
      });

      expect(content).to.contain('git_branch   = "release"');
      expect(content).to.contain('git_enabled  = false');
    });

    it('renders terraform cloud module with variable sets disabled', () => {
      const content = generateTerraformCloudTF({
        driver: 'terraform-cloud',
        tfCloudOrg: 'dasmeta',
        tfCloudWorkspace: 'infrastructure',
        gitProvider: GIT_PROVIDER.GITHUB,
        gitOrg: 'dasmeta',
        gitRepo: 'infra',
        aws: { enabled: false },
        tfeTokenVariableSet: { enabled: false },
      });

      expect(content).to.contain('  tfe_token_variable_set = {\n    enabled = false\n  }');
      expect(content).to.contain('  aws = {\n    enabled           = false\n    access_key_id     = var.access_key_id');
    });

    it('renders terraform cloud module with custom variable set names', () => {
      const content = generateTerraformCloudTF({
        driver: 'terraform-cloud',
        tfCloudOrg: 'dasmeta',
        tfCloudWorkspace: 'infrastructure',
        aws: { variableSetName: 'aws_credentials_shared' },
        tfeTokenVariableSet: { name: 'tfe-token-shared' },
      });

      expect(content).to.contain('    variable_set_name = "aws_credentials_shared"');
      expect(content).to.contain('    name    = "tfe-token-shared"');
      expect(content).to.not.contain('enabled');
    });

    it('renders terramate module with backend and sharing options', () => {
      const content = generateTerramateTF({
        driver: 'terramate',
        gitProvider: GIT_PROVIDER.GITHUB,
        gitOrg: 'dasmeta',
        gitRepo: 'infra',
        terraformBackend: {
          name: 's3',
          configs: {
            bucket: 'example-state',
            region: 'eu-central-1',
            key: 'terramate',
          },
        },
        linkingMode: 'terramate_outputs_sharing',
        mockInputsEnabled: true,
        stackIdPrefix: 'example',
      });

      expect(content).to.contain('terraform {');
      expect(content).to.contain('backend "s3" {');
      expect(content).to.contain('bucket = "example-state"');
      expect(content).to.contain('source  = "dasmeta/cli/terramate"');
      expect(content).to.contain('terraform_backend = {');
      expect(content).to.contain('linking_mode = "terramate_outputs_sharing"');
      expect(content).to.contain('mock_inputs_enabled = true');
      expect(content).to.contain('stack_id_prefix = "example"');
      expect(content).to.contain('targetdir = "${path.module}/_terraform"');
    });

    it('renders terragrunt module with backend', () => {
      const content = generateTerragruntTF({
        driver: 'terragrunt',
        gitProvider: GIT_PROVIDER.GITHUB,
        gitOrg: 'dasmeta',
        gitRepo: 'infra',
        terraformBackend: {
          name: 'local',
          configs: {
            path: '.terragrunt-state',
          },
        },
      });

      expect(content).to.contain('terraform {');
      expect(content).to.contain('backend "local" {');
      expect(content).to.contain('path = ".terragrunt-state"');
      expect(content).to.contain('source  = "dasmeta/cli/terragrunt"');
      expect(content).to.contain('targetdir = "${path.module}/_terragrunt"');
    });

    it('renders terramate root backend from http config', () => {
      const content = generateTerramateTF({
        driver: 'terramate',
        gitProvider: GIT_PROVIDER.GITLAB,
        gitOrg: 'kauz-ai',
        gitRepo: 'terraform',
        terraformBackend: {
          name: 'http',
          configs: {
            address: 'https://gitlab.example.com/api/v4/projects/1/terraform/state/terramate-default',
            username: 'gitlab-ci-token',
            password: 'token',
          },
        },
      });

      expect(content).to.contain('backend "http" {');
      expect(content).to.contain('address = "https://gitlab.example.com/api/v4/projects/1/terraform/state/terramate-default"');
    });
  });
});
