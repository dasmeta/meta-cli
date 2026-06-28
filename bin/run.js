#!/usr/bin/env node

const path = require('node:path');

// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => {
  if (!process.env.META_SKIP_AUTOCOMPLETE) {
    try {
      // Fallback when npm lifecycle scripts are skipped (e.g. npm 11 allow-scripts).
      require(path.join(__dirname, '..', 'scripts', 'autocomplete-setup')).ensureAutocompleteSetup({
        root: path.join(__dirname, '..'),
        installShellHook: process.env.npm_config_global === 'true',
        onlyIfCacheMissing: true,
        silent: true,
      });
    } catch {
      // Autocomplete setup is best-effort and must not block CLI usage.
    }
  }

  const oclif = await import('@oclif/core');
  await oclif.execute({dir: __dirname});
})();
