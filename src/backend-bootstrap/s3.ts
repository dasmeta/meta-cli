import { BootstrapPlan, S3BackendInput } from './types';

export function buildS3Plan(input: S3BackendInput): BootstrapPlan {
  const { bucket, region } = input;
  const locationConstraint = region === 'us-east-1' ? [] : ['--create-bucket-configuration', `LocationConstraint=${region}`];

  return {
    backend: 's3',
    summary: `Ensure S3 bucket "${bucket}" exists in ${region} with versioning, encryption, and public access blocked.`,
    steps: [
      {
        action: 'check',
        description: 'Verify AWS credentials',
        command: 'aws',
        args: ['sts', 'get-caller-identity'],
      },
      {
        action: 'check',
        description: `Check whether bucket "${bucket}" already exists`,
        command: 'aws',
        args: ['s3api', 'head-bucket', '--bucket', bucket],
      },
      {
        action: 'create',
        description: `Create bucket "${bucket}"`,
        command: 'aws',
        args: ['s3api', 'create-bucket', '--bucket', bucket, '--region', region, ...locationConstraint],
      },
      {
        action: 'configure',
        description: 'Enable bucket versioning',
        command: 'aws',
        args: ['s3api', 'put-bucket-versioning', '--bucket', bucket, '--versioning-configuration', 'Status=Enabled'],
      },
      {
        action: 'configure',
        description: 'Block public access',
        command: 'aws',
        args: ['s3api', 'put-public-access-block', '--bucket', bucket, '--public-access-block-configuration', 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'],
      },
      {
        action: 'configure',
        description: 'Enable default encryption (AES256)',
        command: 'aws',
        args: ['s3api', 'put-bucket-encryption', '--bucket', bucket, '--server-side-encryption-configuration', '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'],
      },
    ],
  };
}

export async function provisionS3(
  input: S3BackendInput,
  runStep: typeof import('./runner').runStep,
  log: (message: string, ...args: unknown[]) => void,
): Promise<void> {
  const plan = buildS3Plan(input);
  const [identityStep, headStep, createStep, ...configureSteps] = plan.steps;

  await runStep(identityStep, log);

  const headResult = await runStep(headStep, log);
  const bucketExists = headResult.exitCode === 0;

  if (bucketExists) {
    log(`Bucket "${input.bucket}" already exists — skipping creation.`);
  } else {
    await runStep(createStep, log);
  }

  for (const step of configureSteps) {
    await runStep(step, log);
  }
}
