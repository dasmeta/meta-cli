import fs from 'fs';
import path from 'path';

import { parse } from 'yaml';

import type { MetaConfig } from './utils';
import { normalizeMetaCloudConfig } from './utils';

export type ValidationSeverity = 'error' | 'warning';

export type ValidationIssue = {
  severity: ValidationSeverity;
  file: string;
  code: string;
  message: string;
};

export type ParsedWorkspace = {
  path: string;
  source?: unknown;
  version?: unknown;
  linkedWorkspaces: string[];
  linkedReferences: string[];
  raw: Record<string, unknown>;
};

export type ValidateYamlResult = {
  yamlDir: string;
  workspaces: ParsedWorkspace[];
  issues: ValidationIssue[];
  ok: boolean;
};

const YAML_PARSE_OPTIONS = { uniqueKeys: false } as const;
const LINKED_REF_PATTERN = /\$\{([^}]+)\}/g;
const SHARED_CONFIG_PATTERN = /(^|\/)_\.ya?ml$/;
const WORKSPACE_FILE_PATTERN = /\.ya?ml$/;

function readOptionalFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function shouldSkipDirectory(name: string): boolean {
  return ['node_modules', '.git', '.terraform', '_terraform', '_terragrunt', 'dist'].includes(name);
}

function discoverYamlFiles(yamlDir: string): string[] {
  const results: string[] = [];

  function walk(currentDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) {
          continue;
        }
        walk(fullPath);
        continue;
      }

      if (!entry.isFile() || !WORKSPACE_FILE_PATTERN.test(entry.name)) {
        continue;
      }

      const relPath = path.relative(yamlDir, fullPath).replace(/\\/g, '/');
      if (relPath.includes('.terraform')) {
        continue;
      }

      results.push(relPath);
    }
  }

  walk(yamlDir);
  return results.sort();
}

function isMetaCloudYaml(relPath: string): boolean {
  return relPath === 'metacloud.yaml' || relPath === 'metacloud.yml';
}

function isSharedConfigFile(relPath: string): boolean {
  return SHARED_CONFIG_PATTERN.test(relPath);
}

function workspacePathFromFile(relPath: string): string {
  return relPath.replace(/\.ya?ml$/, '');
}

function discoverFolderSharedConfigs(yamlDir: string): Array<{ folder: string; relPath: string }> {
  return discoverYamlFiles(yamlDir)
    .filter(relPath => relPath.includes('/') && isSharedConfigFile(relPath))
    .map(relPath => ({
      folder: relPath.replace(/\/_\.ya?ml$/, ''),
      relPath,
    }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
}

function mergeYamlContent(yamlDir: string, relFile: string): string {
  const layers = [
    readOptionalFile(path.join(yamlDir, '_.yaml')),
    readOptionalFile(path.join(yamlDir, '_.yml')),
  ];

  for (const shared of discoverFolderSharedConfigs(yamlDir)) {
    if (relFile.includes(shared.folder)) {
      layers.push(readOptionalFile(path.join(yamlDir, shared.relPath)));
    }
  }

  layers.push(readOptionalFile(path.join(yamlDir, relFile)));
  return layers.filter(Boolean).join('\n');
}

function normalizeLinkedSetupName(reference: string): string {
  return reference.replace(/(\..+|\[.+)/, '');
}

const TIER_SETUP_PATH_PATTERN = /^2-products\/(.+)\/([^/]+)\/setups\/[^/]+$/;

export function isLocalModuleSource(source: unknown): boolean {
  if (typeof source !== 'string' || source.length === 0) {
    return false;
  }

  if (source.startsWith('git::') || source.startsWith('http://') || source.startsWith('https://')) {
    return false;
  }

  return source.startsWith('.') || source.startsWith('/') || source.startsWith('~');
}

export function inferTierSetupClusterPath(workspacePath: string, workspacePaths: Set<string>): string | null {
  const match = workspacePath.match(TIER_SETUP_PATH_PATTERN);
  if (!match) {
    return null;
  }

  const clusterPath = `1-environments/${match[1]}/${match[2]}/cluster`;
  return workspacePaths.has(clusterPath) ? clusterPath : null;
}

function effectiveLinkedPaths(workspace: ParsedWorkspace, workspacePaths: Set<string>): string[] {
  const inferred = inferTierSetupClusterPath(workspace.path, workspacePaths);
  return [...new Set([
    ...workspace.linkedWorkspaces,
    ...workspace.linkedReferences,
    ...(inferred ? [inferred] : []),
  ])];
}

function collectLinkedReferences(value: unknown, references: Set<string>): void {
  if (value == null) {
    return;
  }

  if (typeof value === 'string') {
    for (const match of value.matchAll(LINKED_REF_PATTERN)) {
      references.add(normalizeLinkedSetupName(match[1]));
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectLinkedReferences(item, references);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectLinkedReferences(nested, references);
    }
  }
}

function parseLinkedWorkspaces(raw: Record<string, unknown>): string[] {
  const linked = raw['linked_workspaces'];
  if (!Array.isArray(linked)) {
    return [];
  }

  return linked
    .filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function detectLinkedCycles(workspaces: ParsedWorkspace[], workspacePaths: Set<string>): string[][] {
  const graph = new Map<string, string[]>();

  for (const workspace of workspaces) {
    graph.set(workspace.path, effectiveLinkedPaths(workspace, workspacePaths));
  }

  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function visit(node: string): void {
    if (visited.has(node)) {
      return;
    }

    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push([...stack.slice(cycleStart), node]);
      }
      return;
    }

    visiting.add(node);
    stack.push(node);

    for (const dependency of graph.get(node) || []) {
      if (graph.has(dependency)) {
        visit(dependency);
      }
    }

    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const workspace of workspaces) {
    visit(workspace.path);
  }

  return cycles;
}

function validateMetaCloudFile(metacloudPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let data: Record<string, unknown>;

  try {
    data = parse(readOptionalFile(metacloudPath), YAML_PARSE_OPTIONS) as Record<string, unknown>;
  } catch (error) {
    issues.push({
      severity: 'error',
      file: metacloudPath,
      code: 'metacloud-parse-error',
      message: `Failed to parse metacloud.yaml: ${(error as Error).message}`,
    });
    return issues;
  }

  if (!data || typeof data !== 'object') {
    issues.push({
      severity: 'error',
      file: metacloudPath,
      code: 'metacloud-empty',
      message: 'metacloud.yaml must contain a mapping.',
    });
    return issues;
  }

  const config = normalizeMetaCloudConfig(data);
  const driver = config.driver || 'terraform-cloud';

  if (driver === 'terraform-cloud') {
    for (const field of ['gitProvider', 'gitOrg', 'gitRepo'] as const) {
      if (!config[field]) {
        issues.push({
          severity: 'error',
          file: metacloudPath,
          code: 'metacloud-missing-field',
          message: `Missing required metacloud field for ${field} (terraform-cloud driver).`,
        });
      }
    }

    if (!config.tfCloudOrg || !config.tfCloudWorkspace) {
      issues.push({
        severity: 'error',
        file: metacloudPath,
        code: 'metacloud-tfc-missing-fields',
        message: 'terraform-cloud driver requires terraform_cloud_org and terraform_cloud_workspace.',
      });
    }
  }

  if (driver === 'terramate' || driver === 'terragrunt') {
    if (!config.terraformBackend?.name) {
      issues.push({
        severity: 'warning',
        file: metacloudPath,
        code: 'metacloud-missing-backend',
        message: `${driver} driver should define terraform_backend.name in metacloud.yaml.`,
      });
    }
  }

  if (driver === 'terramate' && config.linkingMode && !['remote_state', 'terramate_outputs_sharing'].includes(config.linkingMode)) {
    issues.push({
      severity: 'error',
      file: metacloudPath,
      code: 'metacloud-invalid-linking-mode',
      message: 'linking_mode must be remote_state or terramate_outputs_sharing.',
    });
  }

  return issues;
}

function parseWorkspaceFile(yamlDir: string, relFile: string): { workspace?: ParsedWorkspace; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const workspacePath = workspacePathFromFile(relFile);
  const merged = mergeYamlContent(yamlDir, relFile);

  if (!merged.trim()) {
    return { issues };
  }

  let raw: Record<string, unknown>;
  try {
    raw = parse(merged, YAML_PARSE_OPTIONS) as Record<string, unknown>;
  } catch (error) {
    issues.push({
      severity: 'error',
      file: relFile,
      code: 'yaml-parse-error',
      message: `Failed to parse merged YAML (root/folder shared config + file): ${(error as Error).message}`,
    });
    return { issues };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push({
      severity: 'error',
      file: relFile,
      code: 'yaml-invalid-root',
      message: 'Merged YAML must resolve to a mapping.',
    });
    return { issues };
  }

  const source = raw['source'];
  const version = raw['version'];
  const hasSource = source != null && source !== '';
  const hasVersion = version != null && version !== '';
  const linkedWorkspaces = parseLinkedWorkspaces(raw);
  const linkedReferences = new Set<string>();

  collectLinkedReferences(raw['variables'], linkedReferences);
  collectLinkedReferences(raw['providers'], linkedReferences);

  if (!hasSource && !hasVersion) {
    if (linkedWorkspaces.length > 0 || linkedReferences.size > 0) {
      issues.push({
        severity: 'error',
        file: relFile,
        code: 'workspace-missing-module-metadata',
        message: 'Linked setup references require source (and version for registry modules) after shared-config merge.',
      });
    }
    return { issues };
  }

  if (hasSource && !isLocalModuleSource(source) && !hasVersion) {
    issues.push({
      severity: 'error',
      file: relFile,
      code: 'workspace-missing-version',
      message: 'Registry or remote module sources require version; omit version only for local relative paths.',
    });
    return { issues };
  }

  if (!hasSource && hasVersion) {
    issues.push({
      severity: 'error',
      file: relFile,
      code: 'workspace-incomplete-module-metadata',
      message: 'Workspace requires source when version is set.',
    });
    return { issues };
  }

  if (!hasSource) {
    return { issues };
  }

  return {
    workspace: {
      path: workspacePath,
      source,
      version,
      linkedWorkspaces,
      linkedReferences: [...linkedReferences],
      raw,
    },
    issues,
  };
}

function validateYamlDirectory(input: {
  yamlDir: string;
  metacloudPath?: string;
  strict?: boolean;
}): ValidateYamlResult {
  const yamlDir = path.resolve(input.yamlDir);
  const issues: ValidationIssue[] = [];

  if (!fs.existsSync(yamlDir) || !fs.statSync(yamlDir).isDirectory()) {
    return {
      yamlDir,
      workspaces: [],
      issues: [{
        severity: 'error',
        file: yamlDir,
        code: 'yaml-dir-missing',
        message: `YAML directory does not exist: ${yamlDir}`,
      }],
      ok: false,
    };
  }

  if (input.metacloudPath && fs.existsSync(input.metacloudPath)) {
    issues.push(...validateMetaCloudFile(input.metacloudPath));
  }

  const workspaceFiles = discoverYamlFiles(yamlDir)
    .filter(relPath => !isSharedConfigFile(relPath) && !isMetaCloudYaml(relPath));
  const workspaces: ParsedWorkspace[] = [];

  for (const relFile of workspaceFiles) {
    const parsed = parseWorkspaceFile(yamlDir, relFile);
    issues.push(...parsed.issues);
    if (parsed.workspace) {
      workspaces.push(parsed.workspace);
    }
  }

  const workspacePaths = new Set(workspaces.map(item => item.path));

  for (const workspace of workspaces) {
    for (const linkedPath of workspace.linkedWorkspaces) {
      if (linkedPath === workspace.path) {
        issues.push({
          severity: 'error',
          file: `${workspace.path}.yaml`,
          code: 'linked-self-reference',
          message: `linked_workspaces must not include the workspace itself (${workspace.path}).`,
        });
        continue;
      }

      if (!workspacePaths.has(linkedPath)) {
        issues.push({
          severity: 'error',
          file: `${workspace.path}.yaml`,
          code: 'unknown-linked-workspace',
          message: `linked_workspaces entry "${linkedPath}" does not match any workspace YAML path.`,
        });
      }
    }

    for (const linkedPath of workspace.linkedReferences) {
      if (linkedPath === workspace.path) {
        issues.push({
          severity: 'error',
          file: `${workspace.path}.yaml`,
          code: 'linked-self-reference',
          message: `Linked interpolation must not reference the workspace itself (${workspace.path}).`,
        });
        continue;
      }

      if (!workspacePaths.has(linkedPath)) {
        issues.push({
          severity: 'error',
          file: `${workspace.path}.yaml`,
          code: 'unknown-linked-reference',
          message: `Linked interpolation references unknown workspace "${linkedPath}".`,
        });
      }
    }
  }

  for (const cycle of detectLinkedCycles(workspaces, workspacePaths)) {
    issues.push({
      severity: 'warning',
      file: `${cycle[0]}.yaml`,
      code: 'linked-cycle',
      message: `Linked setup cycle detected: ${cycle.join(' -> ')}.`,
    });
  }

  const hasErrors = issues.some(issue => issue.severity === 'error');
  const hasWarnings = issues.some(issue => issue.severity === 'warning');
  const ok = input.strict ? !(hasErrors || hasWarnings) : !hasErrors;

  return {
    yamlDir,
    workspaces,
    issues,
    ok,
  };
}

function listYamlSetupsFromDirectory(yamlDir: string): ParsedWorkspace[] {
  const resolvedDir = path.resolve(yamlDir);
  const workspaceFiles = discoverYamlFiles(resolvedDir)
    .filter(relPath => !isSharedConfigFile(relPath) && !isMetaCloudYaml(relPath));
  const setups: ParsedWorkspace[] = [];

  for (const relFile of workspaceFiles) {
    const parsed = parseWorkspaceFile(resolvedDir, relFile);
    if (parsed.workspace) {
      setups.push(parsed.workspace);
    }
  }

  return setups;
}

export function listYamlSetups(input: {
  yamlDir: string;
}): {
  yamlDir: string;
  setups: ParsedWorkspace[];
} {
  const yamlDir = path.resolve(input.yamlDir);

  return {
    yamlDir,
    setups: listYamlSetupsFromDirectory(yamlDir),
  };
}

function resolveYamlDir(cwd: string, config: MetaConfig | false, yamlDirFlag?: string): string {
  if (yamlDirFlag) {
    return path.resolve(cwd, yamlDirFlag);
  }

  if (config && config.yamlDir) {
    return path.resolve(cwd, config.yamlDir);
  }

  return cwd;
}

export {
  collectLinkedReferences,
  discoverYamlFiles,
  mergeYamlContent,
  normalizeLinkedSetupName,
  parseWorkspaceFile,
  resolveYamlDir,
  validateMetaCloudFile,
  validateYamlDirectory,
  workspacePathFromFile,
};
