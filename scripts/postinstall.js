'use strict';

const {ensureAutocompleteSetup} = require('./autocomplete-setup');

const isGlobalInstall = process.env.npm_config_global === 'true';

ensureAutocompleteSetup({
  installShellHook: isGlobalInstall,
  onlyIfCacheMissing: false,
  silent: !process.stdout.isTTY,
});
