import log from '../lib/logger';
import IOptions from './IOptions';
import ServerManager from './ServerManager';
import ExpressManager from './Express/ExpressManager';

export default class Server {
    public expressManager: ExpressManager;

    public ready = false;

    constructor(private readonly serverManager: ServerManager, public options: IOptions) {
        this.expressManager = new ExpressManager(this);
    }

    start(): Promise<void> {
        return new Promise((resolve, reject) => {
            log.debug('Setting up server...');
            this.expressManager
                .init()
                .then(() => {
                    this.setReady = true;
                    resolve();
                })
                .catch(err => {
                    if (err) {
                        return reject(err);
                    }

                    if (this.serverManager.isStopping) {
                        // Shutdown is requested, break out of the startup process
                        return resolve();
                    }
                });
        });
    }

    set setReady(isReady: boolean) {
        this.ready = isReady;
    }

    get isReady(): boolean {
        return this.ready;
    }
}
