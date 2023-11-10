import { DB_ENGINE } from "./types";
import { Client } from "./utils";

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

export interface CloudProvider {
    generateConfig(): void;
    openSSO(environment: Client): void;
    exec(environment: Client): void;
    getClusterList(region?: string): string;
    updateKubeConfig(name:string): void;
    getEnv(): { [key: string]: any };
    scanClusters(): Promise<ClusterData>;
    scanDatabases(): Promise<DbData>;
    scanBuckets(): Promise<BucketData>;
}