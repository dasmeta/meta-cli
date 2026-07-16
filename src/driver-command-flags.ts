import { Flags } from '@oclif/core';

import type { MetaDriver } from './utils';

const DRIVER_FLAG = Flags.string({
  description: 'Driver to use when metacloud.yaml is absent (terramate, terragrunt, terraform-cloud)',
  options: ['terraform-cloud', 'terramate', 'terragrunt'],
});

const DIR_FLAG = Flags.string({ description: 'Override the generated driver directory' });

const SETUP_FLAG = Flags.string({
  description: 'Setup name or relative path. Supports repeated flags and comma-separated values.',
  multiple: true,
});

function parseDriverFlag(driver?: string): MetaDriver | undefined {
  return driver as MetaDriver | undefined;
}

export {
  DIR_FLAG,
  DRIVER_FLAG,
  SETUP_FLAG,
  parseDriverFlag,
};
