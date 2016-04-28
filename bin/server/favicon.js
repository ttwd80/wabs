"use strict";

module.exports = function(stats) {
    return function favicon(req, res, next) {
        if (!req.wabs.proxy && req.method === 'GET' && /\/favicon\.ico$/.test(req.url) && stats.get(req.url)) {
            res.set('Content-Type', 'image/x-icon');
            res.sendFile(req.wabs.fsStat.path);
        } else {
            next();
        }
    };
};