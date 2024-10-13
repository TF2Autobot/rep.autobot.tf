import path from 'path';

interface FilePaths {
    options: string;
}

interface LogPaths {
    log: string;
    error: string;
}

export interface Paths {
    files: FilePaths;
    logs: LogPaths;
}

export default function genPaths(): Paths {
    return {
        files: {
            options: path.join(__dirname, `../../files/options.json`)
        },
        logs: {
            log: path.join(__dirname, `../../logs/%DATE%.log`),
            error: path.join(__dirname, `../../logs/error.log`)
        }
    };
}
