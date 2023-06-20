import Server from '../Server';
import express, { Express } from 'express';
import http from 'http';
import path from 'path';
import bodyParser from 'body-parser';
import Index from './Routes/Index';
import Json from './Routes/Json';

export default class ExpressManager {
    public app: Express;

    private serverApp: http.Server;

    constructor(private server: Server) {
        this.app = express();
    }

    init(): Promise<void> {
        return new Promise(resolve => {
            const index = new Index();
            const json = new Json(this.server);

            this.app
                .use(express.static(path.join(__dirname, '../../../public')))
                .set('trust proxy', 1)
                .use(bodyParser.json())
                .use(
                    bodyParser.urlencoded({
                        extended: false
                    })
                );

            this.app.use('/', index.init());
            this.app.use('/json', json.init());

            this.serverApp = this.app.listen(this.server.options.port, () => {
                resolve();
            });
        });
    }

    shutdown(): void {
        this.serverApp.close();
    }
}
