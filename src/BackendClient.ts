import axios, { AxiosInstance } from 'axios';
import { Config, getConfig } from './utils';

class BackendClient {

    private client: AxiosInstance;

    constructor() {

        const config = getConfig() as Config;

        if(!config) {
            throw new Error('Cli not configured');
        }

        this.client = axios.create({
            baseURL: 'https://app.dasmeta.com',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            }
        });
    }

    get(path: string, params = {}) {
        return this.client.get(`/api/${path}`, { params });
    }

    post(path: string, payload = {}) {
        return this.client.post(`/api/${path}`, payload);
    }

    put(path: string, payload = {}) {
        return this.client.put(`/api/${path}`, payload);
    }

    delete(path: string) {
        return this.client.delete(`/api/${path}`);
    }
}

export default BackendClient;