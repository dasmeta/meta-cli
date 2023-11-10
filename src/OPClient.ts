import { execSync, exec, spawn } from 'child_process';

class OPClient {

    private vault;

    constructor() {
        this.vault = process.env.META_CLIENT_NAME;
    }

    private runCommand(command: string, args: string[]): Promise<string|Error> {
        return new Promise((resolve, reject) => {
          const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'inherit'] });
          let output = '';
      
          child.stdout.on('data', (data) => {
            output += data.toString();
          });
      
          child.on('close', (code) => {
            if (code === 0) {
              resolve(output);
            } else {
              reject(new Error(`Command exited with code ${code}`));
            }
          });
        });
      }
      

    async getVariables(): Promise<{ tfToken: string, gitToken: string }> {

        const signinOutput = await this.runCommand('op', ['signin']) as string;
        const sessionTokenLine = signinOutput.trim().split('\n')[0].match(/"(.+?)"/); 
        const sessionToken = sessionTokenLine ? sessionTokenLine[1] : '';

        const tfToken = execSync(`op item get ${this.vault}.TFC_TOKEN --session=${sessionToken} --vault ${this.vault} --format json | jq ".fields[0].value"`).toString().replace(/\"/g, "").trim();
        const gitToken = execSync(`op item get ${this.vault}.GIT_TOKEN --session=${sessionToken} --vault ${this.vault} --format json | jq ".fields[0].value"`).toString().replace(/\"/g, "").trim();
        return {
          tfToken,
          gitToken
        };
    }
}

export default OPClient;