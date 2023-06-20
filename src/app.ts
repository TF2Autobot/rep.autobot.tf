// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-unsafe-assignment
const { version: SERVER_VERSION } = require('../package.json');
import { loadOptions } from './classes/IOptions';

process.env.SERVER_VERSION = SERVER_VERSION as string;

import path from 'path';
import genPaths from './resources/paths';

import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });
const options = loadOptions();
const paths = genPaths();

import log, { init } from './lib/logger';
init(paths);

import ServerManager from './classes/ServerManager';
const serverManager = new ServerManager();

import ON_DEATH from 'death';
import * as inspect from 'util';
import { uptime } from './lib/tools/time';

ON_DEATH({ uncaughtException: true })((signalOrErr, origin) => {
    const crashed = !['SIGINT', 'SIGTERM'].includes(signalOrErr as 'SIGINT' | 'SIGTERM' | 'SIGQUIT');

    if (crashed) {
        log.error(
            [
                'Server' + ' crashed! Please create an issue with the following log:',
                `package.version: ${process.env.SERVER_VERSION || undefined}; node: ${process.version} ${
                    process.platform
                } ${process.arch}}`,
                'Stack trace:',
                inspect.inspect(origin)
            ].join('\r\n')
        );
    } else {
        log.warn('Received kill signal `' + signalOrErr + '`');
    }

    log.info('Server uptime: ' + process.uptime());

    process.exit(crashed ? 1 : 0);
});

serverManager
    .start(options)
    .then(() => {
        log.info(`Server is now live at http://localhost:${options.port}`);
    })
    .catch(err => {
        if (err) {
            throw err;
        }
    });
