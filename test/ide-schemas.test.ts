import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildYamlSchemaMappings,
  findVscodeSettingsDir,
  isIdeYamlSchemasEnabled,
  setupIdeYamlSchemas,
} from '../src/ide-schemas';

describe('ide-schemas', () => {
  const tempRoot = path.join(__dirname, '.tmp-ide-schemas');

  beforeEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.mkdirSync(tempRoot, { recursive: true });
  });

  after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  describe('findVscodeSettingsDir', () => {
    it('prefers an existing .vscode directory up the tree', () => {
      const repo = path.join(tempRoot, 'repo');
      const nested = path.join(repo, 'terraform', 'terramate');

      fs.mkdirSync(path.join(repo, '.vscode'), { recursive: true });
      fs.mkdirSync(nested, { recursive: true });

      expect(findVscodeSettingsDir(nested)).to.equal(path.join(repo, '.vscode'));
    });

    it('creates settings at git root when .vscode is missing', () => {
      const repo = path.join(tempRoot, 'repo-git');
      const nested = path.join(repo, 'terraform', 'terramate');

      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
      fs.mkdirSync(nested, { recursive: true });

      expect(findVscodeSettingsDir(nested)).to.equal(path.join(repo, '.vscode'));
    });
  });

  describe('buildYamlSchemaMappings', () => {
    it('uses unpkg URLs for remote mode', () => {
      const mappings = buildYamlSchemaMappings('terramate', 'remote', '1.2.3', '/tmp/.vscode');

      expect(Object.keys(mappings)).to.have.length(3);
      expect(Object.keys(mappings)[0]).to.equal('https://unpkg.com/@dasmeta/meta-cli@1.2.3/schemas/metacloud/metacloud.schema.json');
      expect(mappings[Object.keys(mappings)[1]]).to.include('**/_.yaml');
    });

    it('includes workspace globs only for terramate and terragrunt', () => {
      const terramate = buildYamlSchemaMappings('terramate', 'remote', '1.0.0', '/tmp/.vscode');
      const cloud = buildYamlSchemaMappings('terraform-cloud', 'remote', '1.0.0', '/tmp/.vscode');

      expect(Object.keys(terramate)).to.have.length(3);
      expect(Object.keys(cloud)).to.have.length(1);
    });
  });

  describe('isIdeYamlSchemasEnabled', () => {
    it('is off unless explicitly enabled', () => {
      expect(isIdeYamlSchemasEnabled()).to.equal(false);
      expect(isIdeYamlSchemasEnabled({})).to.equal(false);
      expect(isIdeYamlSchemasEnabled({ enabled: false })).to.equal(false);
    });

    it('is on when enabled by flag or config, or when a mode is requested', () => {
      expect(isIdeYamlSchemasEnabled({ enabled: true })).to.equal(true);
      expect(isIdeYamlSchemasEnabled({ mode: 'local' })).to.equal(true);
    });

    it('lets skip win over every opt-in', () => {
      expect(isIdeYamlSchemasEnabled({ enabled: true, skip: true })).to.equal(false);
      expect(isIdeYamlSchemasEnabled({ mode: 'remote', skip: true })).to.equal(false);
    });
  });

  describe('setupIdeYamlSchemas', () => {
    it('writes nothing when not enabled', () => {
      const repo = path.join(tempRoot, 'repo-disabled');
      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });

      expect(setupIdeYamlSchemas(repo, 'terramate')).to.equal(null);
      expect(fs.existsSync(path.join(repo, '.vscode'))).to.equal(false);
    });

    it('writes settings when enabled through config', () => {
      const repo = path.join(tempRoot, 'repo-enabled');
      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });

      const result = setupIdeYamlSchemas(repo, 'terramate', { enabled: true, mode: 'local' });

      expect(result).to.not.equal(null);
      expect(fs.existsSync(path.join(repo, '.vscode', 'settings.json'))).to.equal(true);
    });

    it('merges yaml.schemas without removing unrelated settings', () => {
      const repo = path.join(tempRoot, 'repo-settings');
      const vscodeDir = path.join(repo, '.vscode');
      const settingsPath = path.join(vscodeDir, 'settings.json');

      fs.mkdirSync(vscodeDir, { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify({
        'editor.formatOnSave': true,
        'yaml.schemas': {
          'https://example.com/other.schema.json': '**/other.yaml',
        },
      }, null, 2));

      const result = setupIdeYamlSchemas(repo, 'terramate', { mode: 'local' });

      expect(result).to.not.equal(null);
      expect(result?.settingsPath).to.equal(settingsPath);

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
        'editor.formatOnSave': boolean;
        'yaml.schemas': Record<string, string | string[]>;
      };

      expect(settings['editor.formatOnSave']).to.equal(true);
      expect(settings['yaml.schemas']['https://example.com/other.schema.json']).to.equal('**/other.yaml');
      expect(Object.keys(settings['yaml.schemas']).some((key) => key.includes('workspace.schema.json'))).to.equal(true);
      expect(fs.existsSync(path.join(vscodeDir, 'schemas', 'metacloud', 'workspace.schema.json'))).to.equal(true);
    });
  });
});
