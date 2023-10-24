import { Client } from "./utils";

export interface CloudProvider {
    generateConfig(): void;
    openSSO(environment: Client): void;
    exec(environment: Client): void;
    getClusterList(region?: string): string;
    updateKubeConfig(name:string, region:string, clientName: string): void;
}