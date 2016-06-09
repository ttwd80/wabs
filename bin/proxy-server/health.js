'use strict';
const services          = require('./services');

const start = Date.now();

module.exports = function(config) {

    // register the service
    services.register('health', config.endpoint + '/health', 'Get the health of the server');

    return function(req, res, next) {
        if (req.wabs.endpoint === 'health') {
            const diff = Date.now() - start;
            res.json({
                detail: analyzeMilliseconds(diff),
                upTime: diff
            })
        } else {
            next();
        }
    }
};

function analyzeMilliseconds(ms) {
    const days = Math.floor(ms / 86400000);
    ms -= days * 86400000;

    const hours = Math.floor(ms / 3600000);
    ms -= hours * 3600000;

    const minutes = Math.floor(ms / 60000);
    ms -= minutes * 60000;

    const seconds = Math.floor(ms / 1000);
    ms -= seconds * 1000;

    return {
        days: days,
        hours: hours,
        minutes: minutes,
        seconds: seconds,
        milliseconds: ms
    }
}