import { BootstrapPlan, GcsBackendInput } from './types';

export function buildGcsPlan(input: GcsBackendInput): BootstrapPlan {
  const location = input.location || 'europe-west3';
  const bucketUri = `gs://${input.bucket}`;

  return {
    backend: 'gcs',
    summary: `Ensure GCS bucket "${input.bucket}" exists in ${location} with versioning enabled.`,
    steps: [
      {
        action: 'check',
        description: 'Verify gcloud authentication',
        command: 'gcloud',
        args: ['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'],
      },
      {
        action: 'check',
        description: `Check whether bucket "${input.bucket}" exists`,
        command: 'gcloud',
        args: ['storage', 'buckets', 'describe', bucketUri, '--format=value(name)'],
      },
      {
        action: 'create',
        description: `Create bucket "${input.bucket}"`,
        command: 'gcloud',
        args: ['storage', 'buckets', 'create', bucketUri, `--location=${location}`, '--uniform-bucket-level-access'],
      },
      {
        action: 'configure',
        description: 'Enable bucket versioning',
        command: 'gcloud',
        args: ['storage', 'buckets', 'update', bucketUri, '--versioning'],
      },
    ],
  };
}

export async function provisionGcs(
  input: GcsBackendInput,
  runStep: typeof import('./runner').runStep,
  log: (message: string, ...args: unknown[]) => void,
): Promise<void> {
  const plan = buildGcsPlan(input);
  const [authStep, describeStep, createStep, versioningStep] = plan.steps;

  await runStep(authStep, log);

  const describeResult = await runStep(describeStep, log);
  const bucketExists = describeResult.exitCode === 0;

  if (bucketExists) {
    log(`Bucket "${input.bucket}" already exists — skipping creation.`);
  } else {
    await runStep(createStep, log);
  }

  await runStep(versioningStep, log);
}
