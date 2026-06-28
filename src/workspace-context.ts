import fs from 'fs';
import path from 'path';

import { detectSetupDirs, DRIVER_DEFAULT_DIRS } from './driver-runtime';
import { GIT_PROVIDER } from './types';
import { getMetaCloudConfig, type MetaConfig, type MetaDriver } from './utils';

export const META_CLOUD_TF = '_metacloud.tf';
export const META_CLOUD_YAML = 'metacloud.yaml';

export type WorkspaceKind = 'metacloud' | 'terraform-root' | 'standalone-driver';

export type ResolvedWorkspace = {
  kind: WorkspaceKind;
  cwd: string;
  config: MetaConfig;
};

const STANDALONE_GIT_DEFAULTS = {
  gitProvider: GIT_PROVIDER.GITHUB,
  gitOrg: 'local',
  gitRepo: 'local',
};

function listRootTerraformFiles(cwd: string): string[] {
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(cwd, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.tf'))
    .map(entry => entry.name);
}

function hasTerraformRootModule(cwd: string): boolean {
  return listRootTerraformFiles(cwd).length > 0;
}

function isMetaCloudGenerationWorkspace(cwd: string): boolean {
  return fs.existsSync(path.join(cwd, META_CLOUD_TF));
}

function isMetaCloudRepository(cwd: string): boolean {
  return fs.existsSync(path.join(cwd, META_CLOUD_YAML));
}

function collectModuleSources(cwd: string): string[] {
  const sources: string[] = [];

  for (const file of listRootTerraformFiles(cwd)) {
    const content = fs.readFileSync(path.join(cwd, file), 'utf8');
    const pattern = /source\s*=\s*["']([^"']+)["']/g;

    for (const match of content.matchAll(pattern)) {
      sources.push(match[1]);
    }
  }

  return sources;
}

function inferDriverFromModuleSources(sources: string[], cwd: string): MetaDriver | null {
  for (const source of sources) {
    const lower = source.toLowerCase();

    if (lower.includes('terramate') || lower.includes('cli/terramate')) {
      return 'terramate';
    }

    if (lower.includes('terragrunt') || lower.includes('cli/terragrunt')) {
      return 'terragrunt';
    }

    if (lower.includes('tfe-cloud') || lower.includes('cloud/tfe')) {
      return 'terraform-cloud';
    }

    if (source.startsWith('.') || path.isAbsolute(source)) {
      const resolved = path.resolve(cwd, source);
      const base = path.basename(resolved).toLowerCase();

      if (base.includes('terramate')) {
        return 'terramate';
      }

      if (base.includes('terragrunt')) {
        return 'terragrunt';
      }

      if (base.includes('tfe-cloud')) {
        return 'terraform-cloud';
      }
    }
  }

  return null;
}

function inferTargetDirFromTerraformFiles(cwd: string): string | null {
  for (const file of listRootTerraformFiles(cwd)) {
    const content = fs.readFileSync(path.join(cwd, file), 'utf8');
    const match = content.match(/targetdir\s*=\s*["']([^"']+)["']/i);

    if (match) {
      return match[1];
    }
  }

  return null;
}

function inferDriverFromGeneratedOutput(cwd: string): MetaDriver | null {
  if (fs.existsSync(path.join(cwd, '_terragrunt'))) {
    return 'terragrunt';
  }

  const terraformDir = path.join(cwd, '_terraform');
  if (!fs.existsSync(terraformDir)) {
    return null;
  }

  if (detectSetupDirs(terraformDir, 'terramate').length > 0) {
    return 'terramate';
  }

  if (detectSetupDirs(terraformDir, 'terraform-cloud').length > 0) {
    return 'terraform-cloud';
  }

  return 'terramate';
}

function inferStandaloneDriverConfig(cwd: string, options?: {
  driver?: MetaDriver;
  dir?: string;
}): MetaConfig | null {
  if (!hasTerraformRootModule(cwd)) {
    return null;
  }

  const driver = options?.driver
    || inferDriverFromGeneratedOutput(cwd)
    || inferDriverFromModuleSources(collectModuleSources(cwd), cwd);

  if (!driver) {
    return null;
  }

  const targetDir = options?.dir || inferTargetDirFromTerraformFiles(cwd) || DRIVER_DEFAULT_DIRS[driver];

  return {
    driver,
    ...STANDALONE_GIT_DEFAULTS,
    yamlDir: '.',
    targetDir,
  };
}

function resolveDriverConfig(cwd: string, options?: {
  driver?: MetaDriver;
  dir?: string;
}): MetaConfig {
  const config = getMetaCloudConfig(cwd);

  if (config) {
    return config;
  }

  const inferred = inferStandaloneDriverConfig(cwd, options);

  if (inferred) {
    return inferred;
  }

  throw new Error([
    'Could not determine how to run this command in the current directory.',
    'MetaCloud infrastructure repos need metacloud.yaml (run "meta init").',
    'Driver module examples and test harnesses need Terraform root files (*.tf) in the current directory.',
    'Pass --driver terramate|terragrunt|terraform-cloud when auto-detection is not enough.',
  ].join('\n'));
}

function resolveWorkspace(cwd: string, options?: {
  driver?: MetaDriver;
  dir?: string;
}): ResolvedWorkspace {
  if (isMetaCloudRepository(cwd)) {
    return {
      kind: 'metacloud',
      cwd,
      config: resolveDriverConfig(cwd, options),
    };
  }

  if (isMetaCloudGenerationWorkspace(cwd)) {
    return {
      kind: 'metacloud',
      cwd,
      config: resolveDriverConfig(cwd, options),
    };
  }

  const inferred = inferStandaloneDriverConfig(cwd, options);

  if (inferred) {
    return {
      kind: 'standalone-driver',
      cwd,
      config: inferred,
    };
  }

  if (hasTerraformRootModule(cwd)) {
    return {
      kind: 'terraform-root',
      cwd,
      config: resolveDriverConfig(cwd, options),
    };
  }

  throw new Error([
    'No runnable workspace found in the current directory.',
    'Use a directory with metacloud.yaml, _metacloud.tf, or Terraform root files (*.tf).',
  ].join('\n'));
}

function assertTerraformWorkspace(cwd: string): void {
  if (isMetaCloudGenerationWorkspace(cwd) || hasTerraformRootModule(cwd)) {
    return;
  }

  throw new Error([
    `No Terraform workspace found in ${cwd}.`,
    'meta tfi/tfp/tfa/tfd run terraform in the current directory when it contains *.tf files.',
    'MetaCloud infrastructure repos use _metacloud.tf after "meta init".',
    'Driver module examples can run these commands directly without metacloud.yaml.',
  ].join('\n'));
}

export {
  assertTerraformWorkspace,
  hasTerraformRootModule,
  inferStandaloneDriverConfig,
  isMetaCloudGenerationWorkspace,
  isMetaCloudRepository,
  resolveDriverConfig,
  resolveWorkspace,
};
