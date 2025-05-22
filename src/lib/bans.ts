import axios, { AxiosError } from 'axios';
import { BPTFGetUserInfo } from '../types/interfaces/Backpacktf';
import log from '../lib/logger';
import filterAxiosError from '@tf2autobot/filter-axios-error';
import { axiosAbortSignal } from './helpers';
import Server from '../classes/Server';
import { readFile, writeFile } from './files';
import path from 'path';
import { isMoreXHours, isMoreXMinutes } from './tools/time';
import dayjs from 'dayjs';

type Contents = {
    TF2Autobot: SiteResult | string;
    'Marketplace.tf': SiteResult | string;
    'Backpack.tf': SiteResult | string;
    'Steamrep.com': SiteResult | string;
};

interface IsBannedCached {
    isBanned: boolean;
    contents: Contents;
    isBannedExcludeMptf: boolean;
    obtained_time: number;
    last_update: number;
    with_error: boolean;
}

interface SiteResult {
    isBanned: boolean;
    content?: string;
}

interface BansEntry {
    server: Server;
    steamID: string;
    checkMptf: boolean;
}

export interface ResultSources {
    bptf?: SiteResult;
    mptf?: SiteResult;
    steamrep?: SiteResult;
    untrusted?: SiteResult;
}

export default class Bans {
    private _isBptfBanned: SiteResult = null;

    private _isBptfSteamRepBanned: SiteResult = null;

    private _isSteamRepBanned: SiteResult = null;

    private _isCommunityBanned: SiteResult = null;

    private _isMptfBanned: SiteResult = null;

    private untrustedPath: string = path.join(__dirname, '../../public/files/untrusted.json');

    private readonly server: Server;

    private readonly steamID: string;

    private readonly checkMptf: boolean;

    constructor({ server, steamID, checkMptf }: BansEntry) {
        this.server = server;
        this.steamID = steamID;
        this.checkMptf = checkMptf;
    }

    async isBanned(): Promise<IsBannedCached> {
        // always deny by default

        let isExistInCached: IsBannedCached | undefined;
        const p = path.join(__dirname, `../../public/files/reputation/${this.steamID}.json`);

        try {
            isExistInCached = (await readFile({
                p,
                json: true
            })) as IsBannedCached;
        } catch {
            isExistInCached = undefined;
        }

        if (
            isExistInCached &&
            (isExistInCached.with_error ? !isMoreXMinutes({ time: isExistInCached.last_update, duration: 3 }) : true) &&
            !isMoreXHours({ time: isExistInCached.last_update, duration: 24 })
        ) {
            return isExistInCached;
        }

        const results = await Promise.allSettled([
            this.isListedUntrusted(),
            this.isMptfBanned(),
            this.isBptfBanned(),
            this.isSteamRepMarked()
        ]);

        const with_error = results.some(r => r.status === 'rejected');

        const currentTime = dayjs().unix();
        const toReturn: IsBannedCached = {
            isBanned:
                this._isCommunityBanned?.isBanned ||
                this._isMptfBanned?.isBanned ||
                this._isBptfBanned?.isBanned ||
                this._isSteamRepBanned?.isBanned,
            isBannedExcludeMptf:
                this._isCommunityBanned?.isBanned || this._isBptfBanned?.isBanned || this._isSteamRepBanned?.isBanned,
            contents: {
                TF2Autobot:
                    results[0].status === 'fulfilled'
                        ? this._isCommunityBanned
                        : !isExistInCached?.with_error
                        ? isExistInCached.contents?.TF2Autobot
                        : 'Error',
                'Marketplace.tf':
                    results[1].status === 'fulfilled'
                        ? this._isMptfBanned
                        : !isExistInCached?.with_error
                        ? isExistInCached.contents?.['Marketplace.tf']
                        : 'Error',
                'Backpack.tf':
                    results[2].status === 'fulfilled'
                        ? this._isBptfBanned
                        : !isExistInCached?.with_error
                        ? isExistInCached.contents?.['Backpack.tf']
                        : 'Error',
                'Steamrep.com':
                    results[3].status === 'fulfilled'
                        ? this._isSteamRepBanned
                        : !isExistInCached?.with_error
                        ? isExistInCached.contents?.['Steamrep.com']
                        : 'Error'
            },
            obtained_time: isExistInCached?.obtained_time ?? currentTime,
            last_update: currentTime,
            with_error
        };

        void writeFile({ p, data: toReturn, json: true });
        return toReturn;
    }

    private isBptfBanned(): Promise<SiteResult | undefined> {
        return new Promise((resolve, reject) => {
            axios({
                url: 'https://api.backpack.tf/api/users/info/v1',
                headers: {
                    'User-Agent': 'autobot.tf@' + process.env.VERSION
                },
                params: {
                    key: this.server.options.bptfApiKey,
                    steamids: this.steamID
                }
            })
                .then(response => {
                    const user = (response.data as BPTFGetUserInfo).users[this.steamID];
                    const isBptfBanned =
                        user.bans && (user.bans.all !== undefined || user.bans['all features'] !== undefined);

                    const banReason = user.bans ? user.bans.all?.reason ?? user.bans['all features']?.reason ?? '' : '';

                    this._isBptfBanned = {
                        isBanned: isBptfBanned,
                        content: banReason
                    };
                    this._isBptfSteamRepBanned = {
                        isBanned: user.bans?.steamrep_scammer === 1,
                        content: banReason
                    };

                    return resolve(this._isBptfBanned);
                })
                .catch((err: AxiosError) => {
                    if (err) {
                        log.warn('Failed to get data from backpack.tf');
                        return reject(filterAxiosError(err));
                    }
                });
        });
    }

    private isSteamRepMarked(): Promise<SiteResult | undefined> {
        return new Promise((resolve, reject) => {
            axios({
                url: 'https://steamrep.com/api/beta4/reputation/' + this.steamID,
                params: {
                    json: 1
                }
            })
                .then(response => {
                    const isSteamRepBanned =
                        (response.data as SteamRep).steamrep.reputation?.summary.toLowerCase().indexOf('scammer') !==
                        -1;
                    const fullRepInfo = (response.data as SteamRep).steamrep.reputation?.full ?? '';

                    this._isSteamRepBanned = { isBanned: isSteamRepBanned, content: fullRepInfo };
                    return resolve(this._isSteamRepBanned);
                })
                .catch((err: AxiosError) => {
                    if (err) {
                        log.warn('Failed to get data from SteamRep');
                        if (this._isBptfSteamRepBanned !== null) {
                            log.warn('But data from Backpack.tf is available.');
                            this._isSteamRepBanned = this._isBptfSteamRepBanned;
                            return resolve({
                                isBanned: this._isBptfSteamRepBanned.isBanned,
                                content: this._isBptfSteamRepBanned.content
                            });
                        }
                        return reject(filterAxiosError(err));
                    }
                });
        });
    }

    private isMptfBanned(): Promise<SiteResult | undefined> {
        return new Promise((resolve, reject) => {
            axios({
                method: 'POST',
                url: 'https://marketplace.tf/api/Bans/GetUserBan/v2',
                headers: {
                    'User-Agent': 'autobot.tf@' + process.env.VERSION
                },
                params: {
                    key: this.server.options.mptfApiKey,
                    steamid: this.steamID
                }
            })
                .then(response => {
                    const results = (response.data as MptfGetUserBan)?.results;

                    if (!Array.isArray(results)) {
                        log.warn('Marketplace.tf returned invalid data', results);
                        return reject(undefined);
                    }

                    const resultSize = results.length;
                    for (let i = 0; i < resultSize; i++) {
                        if (this.steamID === results[i].steamid) {
                            this._isMptfBanned = {
                                isBanned: results[i].banned ?? false,
                                content: results[i].ban?.type ?? ''
                            };

                            return resolve(this._isMptfBanned);
                        }
                    }

                    return resolve({ isBanned: false });
                })
                .catch((err: AxiosError) => {
                    if (err) {
                        log.warn('Failed to get data from Marketplace.tf', err);
                        return reject(filterAxiosError(err));
                    }
                });
        });
    }

    private isListedUntrusted(attempt: 'first' | 'retry' = 'first'): Promise<SiteResult | undefined> {
        return new Promise((resolve, reject) => {
            axios({
                method: 'GET',
                url: 'https://raw.githubusercontent.com/TF2Autobot/untrusted-steam-ids/master/untrusted.min.json',
                signal: axiosAbortSignal(60000)
            })
                .then(response => {
                    const results = (response.data as UntrustedJson).steamids[this.steamID];

                    if (results === undefined) {
                        return resolve({ isBanned: false });
                    }

                    this._isCommunityBanned = {
                        isBanned: true,
                        content: `Reason: ${results.reason} - Source: ${results.source}`
                    };

                    writeFile({ p: this.untrustedPath, data: response.data, json: true }).catch(err => {
                        log.error('Error saving untrusted file:', err);
                    });
                    return resolve(this._isCommunityBanned);
                })
                .catch((err: AxiosError) => {
                    if (err instanceof AbortSignal && attempt !== 'retry') {
                        return this.isListedUntrusted('retry');
                    }
                    if (err) {
                        log.warn('Failed to get data from Github');
                        log.debug(err instanceof AxiosError ? filterAxiosError(err) : err);
                    }

                    log.warn('Getting cached data...');

                    readFile({ p: this.untrustedPath, json: true })
                        .then(data => {
                            const untrusted = (data as UntrustedJson).steamids[this.steamID];
                            if (untrusted === undefined) {
                                return resolve({ isBanned: false });
                            }

                            this._isCommunityBanned = {
                                isBanned: true,
                                content: `Reason: ${untrusted.reason} - Source: ${untrusted.source}`
                            };
                            return resolve(this._isCommunityBanned);
                        })
                        .catch(() => {
                            log.error('Error reading untrusted file');
                            reject(err instanceof AxiosError ? filterAxiosError(err) : err);
                        });
                });
        });
    }
}

interface MptfGetUserBan {
    success: boolean;
    results: MptfResult[];
}

interface MptfResult {
    steamid: string;
    id: number;
    name: string;
    banned: boolean;
    ban?: MptfBan;
    seller: boolean;
}

interface MptfBan {
    time: number;
    type: string;
}

interface SteamRep {
    steamrep: Details;
}

interface Details {
    flags: Flags;
    steamID32?: string;
    steamID64?: string;
    steamrepurl?: string;
    reputation?: Reputation;
}

interface Flags {
    status: string;
}

interface Reputation {
    full?: string;
    summary?: string;
}

interface UntrustedJson {
    last_update: number;
    steamids: UntrustedJsonSteamids;
}

interface UntrustedJsonSteamids {
    [steamID: string]: UntrustedJsonSteamidsContent;
}

interface UntrustedJsonSteamidsContent {
    reason: string;
    source: string;
    time: number;
}
