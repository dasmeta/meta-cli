export enum PROVIDER {
    AWS = 'Amazon Web Services'
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