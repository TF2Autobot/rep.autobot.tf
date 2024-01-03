// Temporary rate-limit implementation
// Reference: https://blog.logrocket.com/rate-limiting-node-js/

import rateLimit from 'express-rate-limit';

export const rateLimiterUsingThirdParty = rateLimit({
    windowMs: 1000,
    max: 2,
    message: 'You have exceeded the 2 requests/second limit!',
    standardHeaders: true,
    legacyHeaders: false
});
