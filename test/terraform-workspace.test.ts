import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect } from 'chai';

import { assertTerraformWorkspace, collectTerraformPassthroughArgs, runTerraformWorkspace } from '../src/terraform-workspace';

describe('terraform workspace', () => {
  describe('collectTerraformPassthroughArgs', () => {
    it('passes native terraform flags without a separator', () => {
      expect(collectTerraformPassthroughArgs(['-target=module.example'])).to.deep.equal(['-target=module.example']);
    });

    it('passes flags and values without a separator', () => {
      expect(collectTerraformPassthroughArgs(['-target', 'module.example'])).to.deep.equal(['-target', 'module.example']);
    });

    it('passes args after -- unchanged', () => {
      expect(collectTerraformPassthroughArgs(['--', '-target=module.example'])).to.deep.equal(['-target=module.example']);
    });
  });

  describe('assertTerraformWorkspace', () => {
    let tmpDir = '';

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-tf-workspace-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    });

    it('passes when _metacloud.tf exists', () => {
      fs.writeFileSync(path.join(tmpDir, '_metacloud.tf'), 'module "metacloud" {}\n');

      expect(() => assertTerraformWorkspace(tmpDir)).to.not.throw();
    });

    it('passes when Terraform root files exist', () => {
      fs.writeFileSync(path.join(tmpDir, 'main.tf'), 'module "this" {}\n');

      expect(() => assertTerraformWorkspace(tmpDir)).to.not.throw();
    });

    it('fails when no terraform workspace exists', () => {
      expect(() => assertTerraformWorkspace(tmpDir)).to.throw('No Terraform workspace found');
    });
  });

  describe('runTerraformWorkspace', () => {
    let tmpDir = '';

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-tf-workspace-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    });

    it('fails before running terraform when no workspace exists', async () => {
      try {
        await runTerraformWorkspace({
          action: 'init',
          cwd: tmpDir,
        });
        expect.fail('expected runTerraformWorkspace to throw');
      } catch (error) {
        expect((error as Error).message).to.contain('No Terraform workspace found');
      }
    });
  });
});
