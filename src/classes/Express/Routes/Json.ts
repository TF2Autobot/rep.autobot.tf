import log from '../../../lib/logger';
import express, { Router } from 'express';
import Server from '../../Server';
import { rateLimiterUsingThirdParty } from '../Middlewares/rateLimiter';
import axios from 'axios';
import { readFile, writeFile } from '../../../lib/files';
import path from 'path';
import SteamID from 'steamid';
import Bans from '../../../lib/bans';

export default class Json {
    constructor(private server: Server) {}

    init(): Router {
        // should do something at GET /json (/) ?

        const router = express.Router();

        router.get('/:steamid', (req, res) => {
            const input = req.params.steamid;
            const query = req.query.checkMptf;
            log.debug(`Got /json/${input}`);

            if (!input) {
                return res.status(400).json({ success: false, message: 'SteamID undefined.' });
            }

            const steamID = new SteamID(input);

            if (!steamID.isValid()) {
                return res.status(400).json({ success: false, message: 'SteamID entered not valid.' });
            }

            const checkReputation = new Bans({
                server: this.server,
                steamID: steamID.toString(),
                checkMptf: !!query
            });

            checkReputation
                .isBanned()
                .then(result => {
                    return res.json(result);
                })
                .catch(err => {
                    log.error('Error on checkReputation', err);
                    return res.status(500).json({ message: 'Error while getting reputation results.' });
                });
        });

        router.get('/github/untrusted', (req, res) => {
            log.info(`Got GET /json/github/untrusted request`);
            const savePath = path.join(__dirname, '../../../../public/files/untrusted.json');
            axios({
                method: 'GET',
                url: 'https://raw.githubusercontent.com/TF2Autobot/untrusted-steam-ids/master/untrusted.min.json'
            })
                .then(response => {
                    writeFile({ p: savePath, data: (response.data, null, 2), json: true })
                        .then(() => {
                            return res.json(response.data);
                        })
                        .catch(err => {
                            if (err) log.error('Error saving untrusted file', err);
                            // still send the data
                            return res.json(response.data);
                        });
                })
                .catch(err => {
                    log.error('Error getting untrusted file from Github', err);
                    log.warn('Sending cached file');

                    readFile({ p: savePath, json: true })
                        .then(data => {
                            return res.json(data);
                        })
                        .catch(err => {
                            log.error('Error while reading the untrusted file.', err);
                            return res.status(500).json({ message: 'Error while reading the file.' });
                        });
                });
        });

        return router;
    }
}
