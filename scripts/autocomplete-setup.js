'use strict';

const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_DIRNAME = 'meta';

function shouldSkipSetup() {
  if (process.env.META_SKIP_AUTOCOMPLETE === '1') {
    return true;
  }

  if (process.env.CI === 'true' || process.env.CI === '1') {
    return true;
  }

  if (process.env.npm_config_ignore_scripts === 'true') {
    return true;
  }

  return false;
}

function packageRoot(optionsRoot) {
  return optionsRoot || path.join(__dirname, '..');
}

function hasBuiltCommands(root) {
  return fs.existsSync(path.join(root, 'dist', 'commands'));
}

function getCacheDir() {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();

  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', CLI_DIRNAME);
  }

  const xdgCache = process.env.XDG_CACHE_HOME;
  if (xdgCache) {
    return path.join(xdgCache, CLI_DIRNAME);
  }

  return path.join(home, '.cache', CLI_DIRNAME);
}

function isAutocompleteCacheReady() {
  const cacheDir = getCacheDir();
  const markers = [
    path.join(cacheDir, 'autocomplete', 'functions', 'zsh', '_meta'),
    path.join(cacheDir, 'autocomplete', 'functions', 'bash', 'meta.bash'),
    path.join(cacheDir, 'autocomplete', 'zsh_setup'),
    path.join(cacheDir, 'autocomplete', 'bash_setup'),
  ];

  return markers.some((marker) => fs.existsSync(marker));
}

function runMeta(root, args, {silent = true} = {}) {
  const runJs = path.join(root, 'bin', 'run.js');
  return spawnSync(process.execPath, [runJs, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {...process.env, META_SKIP_AUTOCOMPLETE: '1'},
    stdio: silent ? 'pipe' : 'inherit',
  });
}

function refreshAutocompleteCache(root, {silent = true} = {}) {
  return runMeta(root, ['autocomplete', '--refresh-cache'], {silent});
}

function detectShellName() {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) {
    return 'zsh';
  }

  if (shell.includes('bash')) {
    return 'bash';
  }

  return undefined;
}

function shellProfilePath(shellName) {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  if (shellName === 'zsh') {
    return path.join(home, '.zshrc');
  }

  if (shellName === 'bash') {
    return path.join(home, '.bashrc');
  }

  return undefined;
}

function profileHasAutocompleteHook(content) {
  return content.includes('META_AC_ZSH_SETUP_PATH')
    || content.includes('META_AC_BASH_SETUP_PATH')
    || content.includes('meta autocomplete');
}

function installShellHook(root, {silent = false} = {}) {
  if (!process.stdout.isTTY) {
    return false;
  }

  const shellName = detectShellName();
  if (!shellName) {
    return false;
  }

  const profilePath = shellProfilePath(shellName);
  if (!profilePath || !fs.existsSync(profilePath)) {
    return false;
  }

  const profile = fs.readFileSync(profilePath, 'utf8');
  if (profileHasAutocompleteHook(profile)) {
    return false;
  }

  const result = runMeta(root, ['autocomplete', 'script', shellName], {silent: true});
  const hook = result.stdout?.trim();
  if (!hook || result.status !== 0) {
    return false;
  }

  fs.appendFileSync(profilePath, `\n${hook}\n`);

  if (!silent) {
    process.stdout.write(
      `\nAdded meta shell autocomplete to ${profilePath}.\n`
      + `Restart your shell or run: source ${profilePath}\n`,
    );
  }

  return true;
}

function ensureAutocompleteSetup(options = {}) {
  const {
    root: optionsRoot,
    silent = true,
    installShellHook: shouldInstallShellHook = false,
    onlyIfCacheMissing = false,
  } = options;

  if (shouldSkipSetup()) {
    return {skipped: true, reason: 'env'};
  }

  const root = packageRoot(optionsRoot);
  if (!hasBuiltCommands(root)) {
    return {skipped: true, reason: 'no-dist'};
  }

  if (onlyIfCacheMissing && isAutocompleteCacheReady()) {
    return {skipped: true, reason: 'cache-ready'};
  }

  const cacheResult = refreshAutocompleteCache(root, {silent});
  const shellHookInstalled = shouldInstallShellHook
    ? installShellHook(root, {silent})
    : false;

  return {
    skipped: false,
    cacheStatus: cacheResult.status,
    shellHookInstalled,
  };
}

module.exports = {
  ensureAutocompleteSetup,
  getCacheDir,
  isAutocompleteCacheReady,
};
