export enum PROVIDER {
    AWS = 'Amazon Web Services',
    AZURE = 'Azure',
    GCP = 'Google Cloud Platform',
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
    MYSQL = 93,
    CRONJOB = 75,
    S3 = 76,
    MARIADB = 77,
    POSTGRES_GCP = 91,
    MYSQL_GCP = 92,
    GCS = 90,
    SQS = 95,
    ES_AWS = 96,
    REDIS_AWS = 97
}

export enum DB_ENGINE {
    POSTGRES = 'postgres',
    MYSQL = 'mysql',
    MARIADB = 'mariadb'
}

export enum CACHE_ENGINE {
    REDIS = 'redis'
}

export enum MODULE_TYPE {
    DB = 1,
    BUCKET = 2,
    APPLICATION = 3
}

export enum COMPONENT_SOURCE {
    SCANNER = 'scanner',
    MANUAL = 'manual'
}

export type Account = {
    name: string;
    accountId: string;
    alias: string;
    provider: PROVIDER;
    parentAccount: Account | null;
} & Partial<AwsConfig> & Partial<KubernetesConfig> & Partial<GcpConfig>

export type AwsConfig = {
    defaultRegion: string;
    defaultRole: string;
    ssoAlias: string;
    region?: string;
    regions?: Array<string>;
}

export type GcpConfig = {
    region?: string;
    zone?: string;
    regions?: Array<string>;
}

export type KubernetesConfig = {
    excludedNamespaces: Array<string>;
}

export type Environment = {[key: string]: string};

export const PROVIDERMAP: {[key: number]: string} = {
    1: PROVIDER.AWS,
    3: PROVIDER.AZURE,
    16: PROVIDER.GCP,
    18: PROVIDER.KUBERNETES
}

export type Component = {
    name: string;
    identifier: string;
    type: UNKNOWN_MODULE;
    moduleName?: string;
    moduleVersion?: string;
    rawData: {[key: string]: any};
}

export type ClusterData = {
    services: Array<{
        name: string;
        identifier: string;
        rawData: {[key: string]: any};
    }>,
    storages: Array<{
        name: string;
        identifier: string;
        rawData: {[key: string]: any};
    }>,
    cronjobs: Array<{
        name: string;
        identifier: string;
        rawData: {[key: string]: any};
    }>
}

export type BucketData = {
    name: string;
    moduleName?: string;
    moduleVersion?: string;
    rawData: {[key: string]: any};
}

export type DbData = {
    name: string;
    identifier: string;
    engine: DB_ENGINE;
    moduleName?: string;
    moduleVersion?: string;
    rawData: {[key: string]: any};
}

export type QueueData = {
    name: string;
    identifier: string;
    moduleName?: string;
    moduleVersion?: string;
    rawData: {[key: string]: any};
}

export type ElasticSearchData = {
    name: string;
    identifier: string;
    moduleName?: string;
    moduleVersion?: string;
    rawData: {[key: string]: any};
}

export type ElastiCacheData = {
    name: string;
    identifier: string;
    engine: CACHE_ENGINE;
    moduleName?: string;
    moduleVersion?: string;
    rawData: {[key: string]: any};
}