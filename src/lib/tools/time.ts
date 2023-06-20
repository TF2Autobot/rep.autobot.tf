import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

import timeZone from 'dayjs/plugin/timezone';
dayjs.extend(timeZone);

import relativeTime from 'dayjs/plugin/relativeTime';
const dayJSConfig = {
    thresholds: [
        { l: 's', r: 1 },
        { l: 'ss', r: 59, d: 'second' },
        { l: 'm', r: 1 },
        { l: 'mm', r: 59, d: 'minute' },
        { l: 'h', r: 1 },
        { l: 'hh', r: 23, d: 'hour' },
        { l: 'd', r: 1 },
        { l: 'dd', r: 29, d: 'day' },
        { l: 'M', r: 1 },
        { l: 'MM', r: 11, d: 'month' },
        { l: 'y' },
        { l: 'yy', d: 'year' }
    ]
};
dayjs.extend(relativeTime, dayJSConfig);

import updateLocale from 'dayjs/plugin/updateLocale';

dayjs.extend(updateLocale);

dayjs.updateLocale('en', {
    relativeTime: {
        future: 'in %s',
        past: '%s ago',
        s: '%d second',
        ss: '%d seconds',
        m: '%d minute',
        mm: '%d minutes',
        h: '%d hour',
        hh: '%d hours',
        d: '%d day',
        dd: '%d days',
        M: '%d month',
        MM: '%d months',
        y: '%d year',
        yy: '%d years'
    }
});

import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(advancedFormat);

export function uptime(): string {
    const currentTime = dayjs();
    const uptimeAsMoment = dayjs.unix(currentTime.unix() - process.uptime());
    const hoursDiff = currentTime.diff(uptimeAsMoment, 'hour');
    const daysDiff = currentTime.diff(uptimeAsMoment, 'day');

    // If the Server has been up for ~1 day, show the exact amount of hours
    // If the Server has been up for ~1 month, show the exact amount of days
    // Otherwise, show the uptime as it is
    if (hoursDiff >= 21.5 && hoursDiff < 35.5) {
        return `Server has been up for a day (${hoursDiff} hours).`;
    } else if (daysDiff >= 25.5) {
        return `Server has been up for a month (${daysDiff} days).`;
    } else {
        return `Server has been up for ${uptimeAsMoment.from(currentTime, true)}.`;
    }
}

export function isMoreXHours({ time, duration }: { time: number; duration: number }): boolean {
    const currentTime = dayjs();
    const inputTime = dayjs.unix(time);
    const hoursDiff = currentTime.diff(inputTime, 'hour');

    if (hoursDiff > duration) {
        return true;
    }

    return false;
}

export function isMoreXMinutes({ time, duration }: { time: number; duration: number }): boolean {
    const currentTime = dayjs();
    const inputTime = dayjs.unix(time);
    const minutesDiff = currentTime.diff(inputTime, 'minute');

    if (minutesDiff > duration) {
        return true;
    }

    return false;
}