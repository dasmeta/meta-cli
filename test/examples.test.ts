import fs from 'node:fs';
import path from 'node:path';

import { expect } from 'chai';
import { parse } from 'yaml';

import { GIT_PROVIDER } from '../src/types';
import type { MetaConfig } from '../src/utils';
import {
  buildMetaCloudConfigContent,
  normalizeMetaCloudConfig,
} from '../src/utils';

const examplesDir = path.join(__dirname, '..', 'examples');

const gitBase = {
  gitProvider: GIT_PROVIDER.GITHUB,
  gitOrg: 'dasmeta',
  gitRepo: 'infrastructure',
};

const gitlabBackend = {
  name: 'http',
  configs: {
    address: 'https://gitlab.example.com/api/v4/projects/123/terraform/state',
    lock_address: 'https://gitlab.example.com/api/v4/projects/123/terraform/state',
    unlock_address: 'https://gitlab.example.com/api/v4/projects/123/terraform/state',
    lock_method: 'POST',
    unlock_method: 'DELETE',
    retry_wait_min: 5,
    username: 'gitlab-ci-token',
    password: 'replace-with-token',
  },
};

function terramateConfig(terraformBackend: MetaConfig['terraformBackend'], extra: Partial<MetaConfig> = {}): MetaConfig {
  const config: MetaConfig = {
    driver: 'terramate',
    targetDir: '_terraform',
    terraformBackend,
    linkingMode: 'terramate_outputs_sharing',
    mockInputsEnabled: true,
  };

  return { ...config, ...extra };
}

function terragruntConfig(terraformBackend: MetaConfig['terraformBackend']): MetaConfig {
  return {
    driver: 'terragrunt',
    targetDir: '_terragrunt',
    terraformBackend,
  };
}

const terraformCloudConfig: MetaConfig = {
  driver: 'terraform-cloud',
  tfCloudOrg: 'dasmeta',
  tfCloudWorkspace: 'infrastructure',
  ...gitBase,
};

const exampleCases: Array<{ driver: string; variant: string; config: MetaConfig }> = [
  { driver: 'terraform-cloud', variant: 'basic', config: terraformCloudConfig },
  {
    driver: 'terraform-cloud',
    variant: 'advanced',
    config: { ...terraformCloudConfig, gitBranch: 'main', gitEnabled: false },
  },
  {
    driver: 'terramate',
    variant: 'basic-s3-backend',
    config: terramateConfig({
      name: 's3',
      configs: { bucket: 'example-state-bucket', region: 'eu-central-1', key: 'terramate' },
    }),
  },
  {
    driver: 'terramate',
    variant: 'basic-gitlab-backend',
    config: terramateConfig(gitlabBackend, { linkingMode: 'remote_state', mockInputsEnabled: undefined }),
  },
  {
    driver: 'terramate',
    variant: 'basic-gcs-backend',
    config: terramateConfig({
      name: 'gcs',
      configs: { bucket: 'example-state-bucket', prefix: 'terramate' },
    }),
  },
  {
    driver: 'terramate',
    variant: 'basic-azure-backend',
    config: terramateConfig({
      name: 'azurerm',
      configs: {
        resource_group_name: 'example-tfstate-rg',
        storage_account_name: 'exampletfstate',
        container_name: 'tfstate',
        key: 'terramate.tfstate',
      },
    }),
  },
  {
    driver: 'terramate',
    variant: 'basic-local-backend',
    config: terramateConfig({
      name: 'local',
      configs: { path: '.terraform-state' },
    }),
  },
  {
    driver: 'terragrunt',
    variant: 'basic-s3-backend',
    config: terragruntConfig({
      name: 's3',
      configs: { bucket: 'example-state-bucket', region: 'eu-central-1', key: 'terragrunt' },
    }),
  },
  {
    driver: 'terragrunt',
    variant: 'basic-gitlab-backend',
    config: terragruntConfig(gitlabBackend),
  },
  {
    driver: 'terragrunt',
    variant: 'basic-gcs-backend',
    config: terragruntConfig({
      name: 'gcs',
      configs: { bucket: 'example-state-bucket', prefix: 'terragrunt' },
    }),
  },
  {
    driver: 'terragrunt',
    variant: 'basic-azure-backend',
    config: terragruntConfig({
      name: 'azurerm',
      configs: {
        resource_group_name: 'example-tfstate-rg',
        storage_account_name: 'exampletfstate',
        container_name: 'tfstate',
        key: 'terragrunt.tfstate',
      },
    }),
  },
  {
    driver: 'terragrunt',
    variant: 'basic-local-backend',
    config: terragruntConfig({
      name: 'local',
      configs: { path: '.terragrunt-state' },
    }),
  },
];

describe('examples', () => {
  for (const { driver, variant, config } of exampleCases) {
    const exampleDir = path.join(examplesDir, driver, variant);

    it(`keeps ${driver}/${variant} metacloud.yaml in sync with buildMetaCloudConfigContent`, () => {
      const expected = buildMetaCloudConfigContent(config);
      const actual = fs.readFileSync(path.join(exampleDir, 'metacloud.yaml'), 'utf8');

      expect(actual).to.equal(expected);
    });

    it(`parses ${driver}/${variant} metacloud.yaml into MetaConfig`, () => {
      const yaml = fs.readFileSync(path.join(exampleDir, 'metacloud.yaml'), 'utf8');
      const parsed = normalizeMetaCloudConfig(parse(yaml) as {[key: string]: unknown});

      expect(parsed.driver || 'terraform-cloud').to.equal(config.driver || 'terraform-cloud');
      if (config.driver === 'terraform-cloud') {
        expect(parsed.gitOrg).to.equal(config.gitOrg);
        expect(parsed.gitRepo).to.equal(config.gitRepo);
        expect(parsed.gitBranch).to.equal(config.gitBranch);
        expect(parsed.gitEnabled).to.equal(config.gitEnabled);
      } else {
        expect(parsed.gitOrg).to.be.undefined;
        expect(parsed.gitRepo).to.be.undefined;
      }

      expect(parsed.yamlDir).to.be.undefined;
    });
  }

  it('includes multi-group linked modules in terramate basic-s3-backend example', () => {
    const moduleC = fs.readFileSync(
      path.join(examplesDir, 'terramate', 'basic-s3-backend', 'group-1', 'module-c.yaml'),
      'utf8',
    );

    expect(moduleC).to.contain('${group-0/module-a["first-string-variable"]}');
    expect(moduleC).to.contain('${group-0/module-b["second-bool-variable"]}');
  });

  it('includes multi-group linked modules in terragrunt basic-s3-backend example', () => {
    const moduleC = fs.readFileSync(
      path.join(examplesDir, 'terragrunt', 'basic-s3-backend', 'group-1', 'module-c.yaml'),
      'utf8',
    );

    expect(moduleC).to.contain('linked_workspaces:');
    expect(moduleC).to.contain('group-0/module-b');
  });
});
