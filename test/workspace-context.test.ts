import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect } from 'chai';

import {
  assertTerraformWorkspace,
  inferStandaloneDriverConfig,
  resolveDriverConfig,
} from '../src/workspace-context';

describe('workspace context', () => {
  let tmpDir = '';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-workspace-context-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('infers terramate driver config from a module example harness', () => {
    const driverRoot = path.join(tmpDir, 'terraform-terramate-cli');
    const exampleDir = path.join(driverRoot, 'examples', 'with-shared-configs');

    fs.mkdirSync(exampleDir, { recursive: true });
    fs.mkdirSync(driverRoot, { recursive: true });
    fs.writeFileSync(
      path.join(exampleDir, '1-example.tf'),
      [
        'module "this" {',
        '  source = "../.."',
        '  yamldir   = path.module',
        '  targetdir = "./_terraform"',
        '}',
      ].join('\n'),
    );

    const config = inferStandaloneDriverConfig(exampleDir);

    expect(config).to.not.equal(null);
    expect(config?.driver).to.equal('terramate');
    expect(config?.targetDir).to.equal('./_terraform');
  });

  it('resolves driver config from metacloud.yaml when present', () => {
    fs.writeFileSync(path.join(tmpDir, 'metacloud.yaml'), [
      'driver: terragrunt',
      'git_provider: github',
      'git_org: dasmeta',
      'git_repo: infra',
      'target_dir: _terragrunt',
    ].join('\n'));

    const config = resolveDriverConfig(tmpDir);

    expect(config.driver).to.equal('terragrunt');
    expect(config.targetDir).to.equal('_terragrunt');
  });

  it('allows terraform commands when root tf files exist without metacloud files', () => {
    fs.writeFileSync(path.join(tmpDir, 'main.tf'), 'module "this" {}\n');

    expect(() => assertTerraformWorkspace(tmpDir)).to.not.throw();
  });

  it('fails terraform workspace detection when no tf files exist', () => {
    expect(() => assertTerraformWorkspace(tmpDir)).to.throw('No Terraform workspace found');
  });
});
