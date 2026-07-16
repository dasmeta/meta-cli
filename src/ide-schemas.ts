import fs from 'fs';
import path from 'path';

import { MetaDriver } from './utils';

export type IdeSchemaMode = 'remote' | 'local';

const SCHEMA_FILES = [
  'metacloud.schema.json',
  'shared-anchors.schema.json',
  'workspace.schema.json',
] as const;

const METACLOUD_GLOBS = ['**/metacloud.yaml'];

const SHARED_ANCHOR_GLOBS = [
  '**/terramate/**/_.yaml',
  '**/terragrunt/**/_.yaml',
  '**/_.yaml',
];

const WORKSPACE_GLOBS = [
  '**/terramate/**/0-accounts/**/*.yaml',
  '**/terramate/**/1-environments/**/*.yaml',
  '**/terramate/**/2-products/**/*.yaml',
  '**/terramate/**/group-*/*.yaml',
  '**/terragrunt/**/group-*/*.yaml',
  '**/0-accounts/**/*.yaml',
  '**/1-environments/**/*.yaml',
  '**/2-products/**/*.yaml',
  '**/group-*/*.yaml',
];

export function getPackageRoot(): string {
  return path.join(__dirname, '..');
}

export function getPackageVersion(): string {
  const pkgPath = path.join(getPackageRoot(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version: string };
  return pkg.version;
}

export function getRemoteSchemaBaseUrl(version: string): string {
  return `https://unpkg.com/@dasmeta/meta-cli@${version}/schemas/metacloud`;
}

export function getBundledSchemaDir(): string {
  return path.join(getPackageRoot(), 'schemas', 'metacloud');
}

export function findVscodeSettingsDir(startDir: string): string {
  let dir = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(dir, '.vscode'))) {
      return path.join(dir, '.vscode');
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }

    if (fs.existsSync(path.join(dir, '.git'))) {
      return path.join(dir, '.vscode');
    }

    dir = parent;
  }

  return path.join(path.resolve(startDir), '.vscode');
}

function copyBundledSchemas(targetDir: string): void {
  const sourceDir = getBundledSchemaDir();

  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of SCHEMA_FILES) {
    fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
  }
}

function removePreviousMetaCloudSchemaEntries(
  yamlSchemas: Record<string, string | string[]>,
): Record<string, string | string[]> {
  const kept: Record<string, string | string[]> = {};

  for (const [schemaPath, globs] of Object.entries(yamlSchemas)) {
    if (
      schemaPath.includes('/schemas/metacloud/')
      || schemaPath.includes('@dasmeta/meta-cli')
      || schemaPath.endsWith('.vscode/schemas/metacloud/metacloud.schema.json')
      || schemaPath.endsWith('.vscode/schemas/metacloud/shared-anchors.schema.json')
      || schemaPath.endsWith('.vscode/schemas/metacloud/workspace.schema.json')
    ) {
      continue;
    }

    kept[schemaPath] = globs;
  }

  return kept;
}

export function buildYamlSchemaMappings(
  driver: MetaDriver,
  mode: IdeSchemaMode,
  version: string,
  settingsDir: string,
): Record<string, string | string[]> {
  const schemaBase = mode === 'remote'
    ? getRemoteSchemaBaseUrl(version)
    : path.join(settingsDir, 'schemas', 'metacloud');

  const mappings: Record<string, string | string[]> = {
    [path.posix.join(schemaBase.replace(/\\/g, '/'), 'metacloud.schema.json')]: METACLOUD_GLOBS,
  };

  if (driver === 'terramate' || driver === 'terragrunt') {
    mappings[path.posix.join(schemaBase.replace(/\\/g, '/'), 'shared-anchors.schema.json')] = SHARED_ANCHOR_GLOBS;
    mappings[path.posix.join(schemaBase.replace(/\\/g, '/'), 'workspace.schema.json')] = WORKSPACE_GLOBS;
  }

  return mappings;
}

export type SetupIdeYamlSchemasResult = {
  settingsPath: string;
  mode: IdeSchemaMode;
  schemaVersion: string;
};

export function setupIdeYamlSchemas(
  cwd: string,
  driver: MetaDriver,
  options: { mode?: IdeSchemaMode; skip?: boolean } = {},
): SetupIdeYamlSchemasResult | null {
  if (options.skip) {
    return null;
  }

  const version = getPackageVersion();
  const mode = options.mode || (version === '0.0.0' ? 'local' : 'remote');
  const vscodeDir = findVscodeSettingsDir(cwd);
  const settingsPath = path.join(vscodeDir, 'settings.json');

  if (mode === 'local') {
    copyBundledSchemas(path.join(vscodeDir, 'schemas', 'metacloud'));
  }

  const additions = buildYamlSchemaMappings(driver, mode, version, vscodeDir);

  fs.mkdirSync(vscodeDir, { recursive: true });

  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
  }

  const existingYamlSchemas = (settings['yaml.schemas'] as Record<string, string | string[]> | undefined) || {};
  settings['yaml.schemas'] = {
    ...removePreviousMetaCloudSchemaEntries(existingYamlSchemas),
    ...additions,
  };

  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

  return {
    settingsPath,
    mode,
    schemaVersion: version,
  };
}
