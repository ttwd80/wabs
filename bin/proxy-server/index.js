'use strict';
const authenticate  = require('./authenticate');
const brownie       = require('./brownie');
const compression   = require('compression');
const cookieParser  = require('cookie-parser');
const express       = require('express');
const health        = require('./health');
const log           = require('./log');
const proxy         = require('./proxy');
const wabs          = require('./wabs');
const wabsScript    = require('./wabs-script');

module.exports = Server;

function Server(config) {
    var app = express();

    // attach middleware
    app.use(compression({}));
    app.use(log());
    app.use(wabs(config));
    app.use(health(config));
    app.use(wabsScript(config));
    app.use(cookieParser());
    app.use(brownie(config));
    app.use(authenticate(config));
    app.use(proxy(config));
    app.use(unhandled);
    app.use(error);

    return new Promise(function(resolve, reject) {
        app.listen(config.port, function(err) {
            if (err) {
                console.error('Could not listen on port ' + config.port + '. ' + err.message);
                reject(err);
            } else {
                console.log('Server listening on port ' + config.port);
                resolve()
            }
        });
    });
}

function error(err, req, res, next) {
    if (err && !res.headersSent) {
        res.sendStatus(500);
        console.error(req.id + ' ' + err.stack);
    } else {
        next();
    }
}

function unhandled(req, res, next) {
    if (req.method !== 'GET') {
        res.sendStatus(405);
    } else {
        res.sendStatus(404);
    }
}