"use strict";

module.exports = function(err, req, res, next) {
    if (err && !res.headersSent) {
        res.sendStatusView(500);
        console.error(req.id + ' ' + err.stack);
    } else {
        next();
    }
};