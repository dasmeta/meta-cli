export type CommandGroup = {
  title: string;
  description: string;
  commandIds: string[];
};

export const COMMAND_GROUPS: CommandGroup[] = [
  {
    title: 'METACLOUD WORKSPACE',
    description: 'Terraform workspace and YAML checks (_metacloud.tf repos and driver module examples)',
    commandIds: ['init', 'tf-bootstrap-backend', 'list', 'validate-yaml', 'tfi', 'tfp', 'tfa', 'tfd'],
  },
  {
    title: 'DRIVER OPERATIONS',
    description: 'Plan, apply, and validate generated setups (terramate, terragrunt, terraform-cloud)',
    commandIds: ['validate', 'plan', 'apply', 'destroy'],
  },
  {
    title: 'SESSION & ACCESS',
    description: 'Authenticate and open client environments',
    commandIds: ['exec', 'open', 'auth', 'configure'],
  },
  {
    title: 'DISCOVERY',
    description: 'Scan cloud resources and refresh metadata',
    commandIds: ['scan', 'refresh'],
  },
];

export const GROUPED_COMMAND_IDS = new Set(COMMAND_GROUPS.flatMap(group => group.commandIds));
