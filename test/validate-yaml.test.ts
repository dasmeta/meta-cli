import fs from 'fs';
import os from 'os';
import path from 'path';

import { expect } from 'chai';

import {
  inferTierSetupClusterPath,
  isLocalModuleSource,
  listYamlSetups,
  mergeYamlContent,
  normalizeLinkedSetupName,
  validateYamlDirectory,
} from '../src/yaml-validation';

describe('yaml validation', () => {
  describe('normalizeLinkedSetupName', () => {
    it('strips bracket and dot suffixes from linked references', () => {
      expect(normalizeLinkedSetupName('group-0/module-a["first-string-variable"]')).to.equal('group-0/module-a');
      expect(normalizeLinkedSetupName('group-0/module-a.output')).to.equal('group-0/module-a');
    });
  });

  describe('isLocalModuleSource', () => {
    it('detects relative and absolute filesystem module paths', () => {
      expect(isLocalModuleSource('../../../../modules/foo')).to.equal(true);
      expect(isLocalModuleSource('/abs/path/module')).to.equal(true);
      expect(isLocalModuleSource('dasmeta/dns/aws')).to.equal(false);
      expect(isLocalModuleSource('git::https://example.com/repo.git')).to.equal(false);
    });
  });

  describe('inferTierSetupClusterPath', () => {
    it('maps tiered setup paths to their cluster workspace', () => {
      const paths = new Set([
        '1-environments/azure/aks/central/cluster',
        '2-products/azure/aks/central/setups/my',
      ]);

      expect(
        inferTierSetupClusterPath('2-products/azure/aks/central/setups/my', paths),
      ).to.equal('1-environments/azure/aks/central/cluster');
      expect(
        inferTierSetupClusterPath('2-products/azure/aks/central/setups/my', new Set()),
      ).to.equal(null);
    });
  });

  describe('validateYamlDirectory', () => {
    let tmpDir = '';

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-yaml-validate-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    });

    it('validates shared-config merge and linked interpolation', () => {
      fs.writeFileSync(path.join(tmpDir, '_.yaml'), [
        'source: &module_source dasmeta/empty/null',
        'version: &module_version 1.2.2',
      ].join('\n'));
      fs.mkdirSync(path.join(tmpDir, 'group-0'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'group-0', 'module-a.yaml'), [
        'source: *module_source',
        'version: *module_version',
        'variables:',
        '  first-string: foo',
      ].join('\n'));
      fs.writeFileSync(path.join(tmpDir, 'group-0', 'module-b.yaml'), [
        'source: *module_source',
        'version: *module_version',
        'variables:',
        '  first-string: ${group-0/module-a["first-string-variable"]}',
      ].join('\n'));

      const result = validateYamlDirectory({ yamlDir: tmpDir });

      expect(result.ok).to.equal(true);
      expect(result.workspaces.map(item => item.path)).to.deep.equal(['group-0/module-a', 'group-0/module-b']);
      expect(result.issues).to.deep.equal([]);
    });

    it('reports unknown linked workspace references', () => {
      fs.writeFileSync(path.join(tmpDir, 'module-a.yaml'), [
        'source: dasmeta/empty/null',
        'version: 1.2.2',
        'variables:',
        '  first-string: ${missing/module["first-string-variable"]}',
      ].join('\n'));

      const result = validateYamlDirectory({ yamlDir: tmpDir });

      expect(result.ok).to.equal(false);
      expect(result.issues.some(issue => issue.code === 'unknown-linked-reference')).to.equal(true);
    });

    it('reports missing version for registry module sources', () => {
      fs.writeFileSync(path.join(tmpDir, 'module-a.yaml'), [
        'source: dasmeta/empty/null',
      ].join('\n'));

      const result = validateYamlDirectory({ yamlDir: tmpDir });

      expect(result.ok).to.equal(false);
      expect(result.issues.some(issue => issue.code === 'workspace-missing-version')).to.equal(true);
    });

    it('accepts local module sources without version', () => {
      fs.writeFileSync(path.join(tmpDir, 'module-a.yaml'), [
        'source: ../../../../modules/example',
        'variables:',
        '  name: test',
      ].join('\n'));

      const result = validateYamlDirectory({ yamlDir: tmpDir });

      expect(result.ok).to.equal(true);
      expect(result.workspaces).to.have.length(1);
    });

    it('lists setups without running validation', () => {
      fs.writeFileSync(path.join(tmpDir, 'module-a.yaml'), [
        'source: dasmeta/empty/null',
        'version: 1.2.2',
        'linked_workspaces:',
        '  - missing/module',
      ].join('\n'));

      const listed = listYamlSetups({ yamlDir: tmpDir });
      const validated = validateYamlDirectory({ yamlDir: tmpDir });

      expect(listed.setups).to.have.length(1);
      expect(listed.setups[0].path).to.equal('module-a');
      expect(validated.ok).to.equal(false);
    });

    it('reports unknown linked_workspaces entries', () => {
      fs.writeFileSync(path.join(tmpDir, 'module-a.yaml'), [
        'source: dasmeta/empty/null',
        'version: 1.2.2',
        'linked_workspaces:',
        '  - missing/module',
      ].join('\n'));

      const result = validateYamlDirectory({ yamlDir: tmpDir });

      expect(result.ok).to.equal(false);
      expect(result.issues.some(issue => issue.code === 'unknown-linked-workspace')).to.equal(true);
    });

    it('merges folder-level shared configs like drivers do', () => {
      fs.mkdirSync(path.join(tmpDir, 'group-0'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'group-0', '_.yaml'), [
        'source: &module_source dasmeta/empty/null',
        'version: &module_version 1.2.2',
      ].join('\n'));
      fs.writeFileSync(path.join(tmpDir, 'group-0', 'module-a.yaml'), [
        'source: *module_source',
        'version: *module_version',
      ].join('\n'));

      const merged = mergeYamlContent(tmpDir, 'group-0/module-a.yaml');
      const result = validateYamlDirectory({ yamlDir: tmpDir });

      expect(merged).to.contain('module_source');
      expect(result.ok).to.equal(true);
      expect(result.workspaces).to.have.length(1);
    });
  });

  describe('examples', () => {
    const examplesDir = path.join(__dirname, '..', 'examples');

    for (const driver of ['terramate', 'terragrunt']) {
      for (const variant of ['basic-s3-backend', 'basic-local-backend']) {
        it(`validates ${driver}/${variant} example YAML`, () => {
          const yamlDir = path.join(examplesDir, driver, variant);
          const result = validateYamlDirectory({ yamlDir });

          expect(result.ok, result.issues.map(issue => issue.message).join('\n')).to.equal(true);
          expect(result.workspaces.length).to.be.greaterThan(0);
        });
      }
    }
  });
});
