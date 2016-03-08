"use strict";
/**
 * This file defines REST endpoint handler functions related to the brownie.
 */
const bodyParser    = require('body-parser');
const chalk         = require('chalk');
const crypt         = require('../brownie/crypt');
const noop          = require('./noop');

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

    // validate brownie configuration
    if (levels.indexOf(config.brownie) === -1) throw Error('Brownie configuration value must be one of: ' + levels.join(', '));
    if (typeof config.brownieUrl !== 'string') throw Error('BrownieUrl must be a string.');

    // if not using the brownie then return noop middleware
    if (config.brownie === 'none') return noop;

    // get the brownie crypto object
    crypto = crypt(config.brownieUrl);

    // return brownie middleware
    return function(req, res, next) {
        if (req.method === 'POST' && req.url.indexOf(config.endpoint) !== 0) {
            decode(crypto, req, res, next);
        } else if (req.method === 'PUT' && req.url.indexOf(config.endpoint + '/brownie/encode') === 0) {
            encode(crypto, req, res, next);
        } else {
            next();
        }
    };
}

Brownie.options = {
    brownie: {
        alias: 'b',
        description: 'Specify the level of brownie support. Valid values include "' + levels.join('", "') + '". \n\n' +
            chalk.bold.cyan('none') + ': Will not provide brownie support.\n\n' +
            chalk.bold.cyan('manual') + ': Will provide brownie data and the library but will not automatically ' +
            'trigger brownie data transfer when navigating to a legacy application.\n\n' +
            chalk.bold.cyan('always') + ': Will provide full brownie support and will automatically cause links that ' +
            'navigate to legacy applications to send that information in a way that the legacy application can ' +
            'interpret it.',
        type: String,
        transform: (v) => v.toLowerCase(),
        validate: (v) => levels.indexOf(v.toLowerCase()) !== -1,
        defaultValue: 'always',
        group: 'brownie'
    },
    brownieUrl: {
        alias: 'u',
        description: 'The URL to use as a web service to encode and decode brownie data.',
        type: String,
        defaultValue: 'https://lambda-tst.byu.edu/ae/prod/brownie-dumper/cgi/brownie-dumper.cgi/json',
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

        // get the brownie and session key
        brownie = req.body.hasOwnProperty('brownie') ? req.body.brownie : null;
        sessionKey = req.cookies.hasOwnProperty('brownie') ? req.cookies.brownie : null;

        // if the brownie is set then decode it
        if (brownie !== null && sessionKey !== null) {
            crypt.decode(brownie, sessionKey)
                .then(function (decodedBrownie) {
                    req.method = 'GET';
                    res.wabs.brownie = decodedBrownie;
                    next();
                })
                .catch(function (err) {
                    next(err);
                });
        } else {
            next();
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