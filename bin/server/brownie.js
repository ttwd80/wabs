"use strict";
/**
 * This file defines REST endpoint handler functions related to the brownie.
 */
const bodyParser    = require('body-parser');
const chalk         = require('chalk');
const crypt         = require('../brownie/crypt');
const noop          = require('./noop');
const services      = require('./services');

// define the urlEncoded parser middleware that will be used to parse POST data from the c-framework
const cFrameworkFormParser = bodyParser.urlencoded({
    extended: false,
    type: '*/x-www-form-urlencoded'
});

// define the json parser
const jsonParser = bodyParser.json();

// define the brownie integration levels
const levels = ['none', 'manual', 'always'];
Object.freeze(levels);


module.exports = Brownie;

function Brownie(config) {
    var crypto;

    console.log('Brownie mode: ' + config.brownie);

    // validate brownie configuration
    if (levels.indexOf(config.brownie) === -1) throw Error('Brownie configuration value must be one of: ' + levels.join(', '));
    if (typeof config.brownieUrl !== 'string') throw Error('BrownieUrl must be a string.');

    // if not using the brownie then return noop middleware
    if (config.brownie === 'none') return noop;

    // get the brownie crypto object
    crypto = crypt(config.brownieUrl);

    // register the web services defined by this middleware
    services.register('brownie.encode', config.endpoint + '/brownie/encode', 'A URL to call with PUT and brownie body to get back an encoded brownie from.');

    // return brownie middleware
    return function brownie(req, res, next) {
        if (req.method === 'POST' && !req.wabs.endpoint) {
            decode(crypto, req, res, next);
        } else if (req.method === 'PUT' && req.wabs.endpoint === 'brownie/encode') {
            encode(crypto, req, res, next);
        } else if (req.method === 'GET' && req.query.hasOwnProperty('wabs-brownie')) {
            let brownie = req.query['wabs-brownie'];
            let sessionKey = req.cookies.hasOwnProperty('brownie') ? req.cookies.brownie : null;
            crypto.decode(brownie, sessionKey)
                .then(function (decodedBrownie) {
                    req.wabs.brownie = decodedBrownie;
                    next();
                })
                .catch(function (err) {
                    next(err);
                });
        } else {
            next();
        }
    };
}

Brownie.options = {
    brownie: {
        alias: 'b',
        description: 'Specify the level of brownie support. Valid values include "' + levels.join('", "') + '". \n\n' +
            chalk.bold.green('none') + ': Will not provide brownie support.\n\n' +
            chalk.bold.green('manual') + ': Will provide brownie data and the library but will not automatically ' +
            'trigger brownie data transfer when navigating to a legacy application.\n\n' +
            chalk.bold.green('always') + ': Will provide full brownie support and will automatically cause links that ' +
            'navigate to legacy applications to send that information in a way that the legacy application can ' +
            'capture it.',
        type: String,
        transform: (v) => v.toLowerCase(),
        validate: (v) => levels.indexOf(v.toLowerCase()) !== -1,
        defaultValue: 'always',
        env: 'WABS_BROWNIE',
        group: 'brownie'
    },
    brownieUrl: {
        alias: 'u',
        description: 'The URL to use as a web service to encode and decode brownie data.',
        type: String,
        defaultValue: 'https://lambda.byu.edu/ae/prod/brownie-dumper/cgi/brownie-dumper.cgi/json', 
        env: 'WABS_BROWNIE_URL',
        group: 'brownie'
    }
};

function decode(crypt, req, res, next) {

    // call the body parser middleware
    cFrameworkFormParser(req, res, function(err) {
        var brownie;
        var sessionKey;

        // if there was an error then pass it along
        if (err) return next(err);

        // get the session key
        brownie = req.body.hasOwnProperty('brownie') ? req.body.brownie : null;
        sessionKey = req.cookies.hasOwnProperty('brownie') ? req.cookies.brownie : null;

        // if we are missing the session key or brownie then we just ignore it and continue processing the request elsewhere
        if (brownie === null || sessionKey === null) return next();

        // if auth mode is always then we have to store the brownie data on the query string
        if (req.wabs.authMode === 'always') {
            let query = Object.assign({}, req.query, { 'wabs-brownie': brownie });
            let url = req.url.split('?')[0];
            Object.keys(query).forEach(function(key, index) {
                var value = query[key];
                url += (index === 0 ? '?' : '&') + key + (('' + value) ? '=' + encodeURIComponent(value) : '');
            });
            res.redirect(url);

        // we don't need to redirect for oauth so we can modify the request
        } else {
            crypt.decode(brownie, sessionKey)
                .then(function (decodedBrownie) {
                    req.method = 'GET';
                    req.wabs.brownie = decodedBrownie;
                    next();
                })
                .catch(function (err) {
                    next(err);
                });
        }
    });
}

function encode(crypt, req, res, next) {
    var brownie;
    var encodedBrownie;

    // call the json body parser
    jsonParser(req, res, function(err) {

        // pass along an error if it occurred
        if (err) return next(err);

        // get the brownie object from the body
        brownie = req.body;

        // if part of the brownie encoding data is missing then do a normal redirect
        if (!brownie || !brownie.hasOwnProperty('__brownie') || !req.cookies.hasOwnProperty('brownie')) {
            return res.redirect(req.body.url);
        }

        // get the encoded brownie data which will be used as the seed to encode the new brownie data
        encodedBrownie = brownie.__brownie.toString();
        delete brownie.__brownie;

        // encode the brownie
        crypt.encode(encodedBrownie, req.cookies.brownie, brownie)
            .then(function(value) {
                res.set('Content-Type', 'text/plain');
                res.send(value.__brownie);
            })
            .catch(function(err) {
                next(err);
            });
    });
}