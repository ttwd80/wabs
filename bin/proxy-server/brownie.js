"use strict";
const bodyParser    = require('body-parser');
const chalk         = require('chalk');
const noop          = require('./noop');
const request       = require('../request');
const services      = require('./services');

// define the urlEncoded parser middleware that will be used to parse POST data from the c-framework
const cFrameworkFormParser = bodyParser.urlencoded({
    extended: false,
    type: '*/x-www-form-urlencoded'
});

// define the json parser
const jsonParser = bodyParser.json();

module.exports = Brownie;

function Brownie(config) {
    var crypto;

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
            let sessionKey = req.hasOwnProperty('cookies') && req.cookies.hasOwnProperty('brownie') ? req.cookies.brownie : null;
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

function crypt(serviceUrl) {
    var factory = {};

    /**
     * Decode a brownie from the C-framework.
     * @param {string} encodedBrownie
     * @param {string} sessionKey
     * @returns {Promise}
     */
    factory.decode = function(encodedBrownie, sessionKey) {
        var options = {
            url: serviceUrl + "?sessionKey=" + sessionKey + '&brownie=' + encodedBrownie,
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };
        return request(options).then(getDecodedBrownieFromResponse);
    };

    /**
     * Encode a brownie for the C-framework.
     * @param {string} encodedBrownie The original encoded brownie that the C-framework sent.
     * @param {string} sessionKey The session key.
     * @param {object} data The data to add to the brownie.
     * @returns {Promise}
     */
    factory.encode = function(encodedBrownie, sessionKey, data) {
        var body = Object.assign({ brownie: encodedBrownie, sessionKey: sessionKey }, data);
        var options = {
            url: serviceUrl,
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        };

        return request(options).then(getDecodedBrownieFromResponse);
    };

    return factory;
}

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

function getDecodedBrownieFromResponse(response) {
    var data = JSON.parse(response.body)['Brownie-dumperService'];
    var result = {};

    // validate the response structure
    if (!data.request || data.request.status !== 200 || !data.response) {
        throw Error('REST response has unexpected structure');
    }

    // iterate through the response properties to build the new decoded brownie object
    if (data.response.properties) {
        data.response.properties.forEach(function(property) {
            var value = property.value;

            //convert strings to the type specified
            if (typeof value === 'string') {
                switch (property.type) {
                    case 'DECIMAL':
                        value = parseFloat(value) || null;
                        break;
                    case 'INTEGER':
                        value = parseInt(value) || null;
                        break;
                }
            }

            //store the property on the result
            result[property.name] = value;
        });
    }

    // return the result
    return result;
}