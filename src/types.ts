export enum PROVIDER {
    AWS = 'Amazon Web Services',
    KUBERNETES = 'Kubernetes',
}

export enum PLATFORM {
    LINUX = 'linux',
    MACOS = 'darwin',
    WINDOWS = 'win32'
}

export enum GIT_PROVIDER {
    GITHUB = 'github',
    GITLAB = 'gitlab',
    BITBUCKET = 'bitbucket'
}

export enum UNKNOWN_MODULE {
    APPLICATION = 74,
    POSTGRES = 73,
    CRONJOB = 75,
    S3 = 76,
    MARIADB = 77,
}

export enum DB_ENGINE {
    POSTGRES = 'postgres',
    MARIADB = 'mariadb'
}

export enum MODULE_TYPE {
    DB = 1,
    BUCKET = 2,
    APPLICATION = 3
}

export type Account = {
    name: string;
    accountId: string;
    alias: string;
    provider: PROVIDER;
    parentAccount: Account | null;
} & Partial<AwsConfig> & Partial<KubernetesConfig>

export type AwsConfig = {
    defaultRegion: string;
    defaultRole: string;
    ssoAlias: string;
    region?: string;
}

export type KubernetesConfig = {
    excludedNamespaces: Array<string>;
}

export type Environment = {[key: string]: string};

export const PROVIDERMAP: {[key: number]: string} = {
    1: PROVIDER.AWS,
    18: PROVIDER.KUBERNETES
}

export type Component = {
    name: string;
    identifier: string;
    type: UNKNOWN_MODULE
}

export type ClusterData = {
    services: Array<{
        name: string;
        identifier: string;
    }>,
    storages: Array<{
        name: string;
        identifier: string;
    }>,
    cronjobs: Array<{
        name: string;
        identifier: string;
    }>
}

export type BucketData = Array<{
    name: string;
}>

export type DbData = Array<{
    name: string;
    identifier: string;
    engine: DB_ENGINE;
}>