import { Account, Component, Environment } from "./types";

export interface Provider {
    generateConfig(account: Account): void;
    exec(account: Account): Environment;
    open(account: Account): void;
    scan(): Promise<Component[]>;
    getEnv(): Environment;
}