import log from '../../../lib/logger';
import express, { Router } from 'express';
import Server from '../../Server';
import { rateLimiterUsingThirdParty } from '../Middlewares/rateLimiter';
import axios from 'axios';
import { readFile, writeFile } from '../../../lib/files';
import path from 'path';
import SteamID from 'steamid';
import Bans from '../../../lib/bans';
import semver from 'semver';

const IS_BANNED = {
    isBanned: true,
    isBannedExcludeMptf: true,
    contents: {
      TF2Autobot: {
        isBanned: true,
      },
    }
};

export default class Json {
    constructor(private server: Server) {}

    init(): Router {
        // should do something at GET /json (/) ?

        const router = express.Router();

        router.get('/:steamid', (req, res) => {
            const userAgent = req.headers['user-agent'];
            if (userAgent && userAgent.startsWith('TF2Autobot@')) {
                const parts = userAgent.split('@');
                if (parts.length == 2 && semver.valid(parts[1]) && semver.lte(parts[1], '5.13.1')) {
                    return res.json(IS_BANNED);
                }
            }

            rateLimiterUsingThirdParty(req, res, () => {
                const input = req.params.steamid;
                const query = req.query.checkMptf;
                log.debug(`Got /json/${input}`);

                if (!input) {
                    return res.status(400).json({ success: false, message: 'SteamID undefined.' });
                }

                let steamID: SteamID;

                try {
                    steamID = new SteamID(input);
                } catch (err) {
                    return res.status(400).json({ success: false, err });
                }

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
