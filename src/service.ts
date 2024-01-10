import BackendClient from './BackendClient';

const client = new BackendClient();

async function getModuleByIdentifier(identifier: string) {

    const { data } = await client.get('modules', {
        filters: {
          identifier: { 
            $eq: identifier
          }
        }
    });

    if(!data.data.length) {
        return false;
    }

    return data.data[0];
}

async function getOrCreateModuleVersion(moduleId: number, version: string) {

    const { data } = await client.get('module-versions', {
        filters: {
            module: {
                id: {
                    $eq: moduleId
                }
            },
            version: {
                $eq: version
            }
        }
    });

    if(data.data.length) {
        data.data[0];
    }

    const created = await client.post('module-versions', {
        data: {
            module: moduleId,
            version
        }
    });

    return created.data.data;
}

async function getOrCreateDefaultProject(clientId: number, clientName: string) {

    const defaultProjectName = `${clientName} // Project created by scan`;

    const { data } = await client.get('projects', {
        filters: {
            client: {
            id: {
                $eq: clientId
            }
            },
            name: {
            $eq: defaultProjectName
            }
        },
        populate: '*' 
    });

    if(data.data.length) {
        return data.data[0];
    }

    const created = await client.post('projects', {
        data: {
        name: defaultProjectName,
        client: clientId
        }
    });

    return created.data.data;
}

export {
    getModuleByIdentifier,
    getOrCreateModuleVersion,
    getOrCreateDefaultProject
}