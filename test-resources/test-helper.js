"use strict";
const authenticate      = require('../bin/server/authenticate');
const bodyParser        = require('body-parser');
const brownie           = require('../bin/server/brownie');
const emptyPort         = require('empty-port');
const endpoint          = require('../bin/endpoint');
const express           = require('express');
const fsStat            = require('../bin/fs-stat');
const init              = require('../bin/server/init');
const mwChain           = require('../bin/middleware-chain');
const path              = require('path');
const Promise           = require('bluebird');
const server            = require('../bin/server/index');

module.exports = Helper;

/**
 * Useful for test initialization.
 * @param {object} store The object to store properties onto.
 * @param {object} [configuration]
 * @returns {Promise}
 */
function Helper(store, configuration) {
    const defaults = {
        src: [ path.resolve(__dirname, '../bin/www') ]
    };
    const config = Helper.configuration(Object.assign(defaults, configuration || {}));
    const endpointMap = endpoint.map(config);

    return fsStat(config, endpointMap)
        .then(function(stats) {
            store.chain = mwChain;
            store.config = config;
            store.middleware = init(config, endpointMap, stats);
            store.stats = stats;
            return store;
        });
}

Helper.brownieServer = function() {
    const response = {
        'Brownie-dumperService': {
            request: {
                status: 200
            },
            response: {
                properties: [
                    {
                        name: "__brownie",
                        group: "0000",
                        type: "TEXT",
                        size: "213",
                        value: "266ab5365a6"
                    }
                ]
            }
        }
    };

    return Helper.server()
        .then(function(o) {
            var app = o.app;
            app.port = o.port;
            app.close = function() {
                o.server.close();
            };

            app.use(bodyParser.json());

            app.get('/', function(req, res) {
                res.json(response);
            });

            app.post('/', function(req, res) {
                res.json(response);
            });

            return app;
        });
};

/**
 * Get a full configuration object.
 * @param {object} config
 * @returns {object}
 */
Helper.configuration = function(config) {
    const result = Object.assign({}, config);

    function processOptions(opts) {
        Object.keys(opts).forEach(function(key) {
            const item = opts[key];
            if (item.required && !result.hasOwnProperty(key)) throw Error('Missing required value for: ' + key);
            if (!result.hasOwnProperty(key) && item.hasOwnProperty('defaultValue')) result[key] = item.defaultValue;
        });
    }

    processOptions(authenticate.options);
    processOptions(brownie.options);
    processOptions(server.options);

    return result;
};

/**
 * Check to see if a function is a middleware function. It can either have the
 * parameters 'req', 'res', 'next' or 'err', 'res', 'next'.
 * @param callback
 * @returns {boolean}
 */
Helper.isMiddlewareFunction = function(callback) {
    return Helper.functionHasParameters(['req', 'res', 'next'], callback) ||
        Helper.functionHasParameters(['err', 'req', 'res', 'next'], callback);
};

/**
 * Check to see if a function has the specified parameter names.
 * @param {string[]} paramNames
 * @param {function} callback
 * @returns {boolean}
 */
Helper.functionHasParameters = function(paramNames, callback) {
    var params;

    if (typeof callback !== 'function') return false;
    params = getParameterNames(callback);

    return paramNames.reduce(function(p, c) {
        return p && params[c] === true;
    }, true);
};

/**
 * Start a server on the port specified.
 * @returns {Promise} that resolves to an object { app: Server, port: number }.
 */
Helper.server = function() {
    return new Promise(function(resolve, reject) {
        var app = express();
        emptyPort({}, function(err, port) {
            if (err) return reject(err);
            var server = app.listen(port, function(err) {
                if (err) return reject(err);
                return resolve({
                    app: app,
                    port: port,
                    server: server
                });
            });
        });
    });
};

function getParameterNames(callback) {
    const rx = /^function (?:[_$a-z][_$a-zA-Z0-9]*)?\(([\s\S]*?)\)/;
    const str = callback.toString();
    const match = rx.exec(str);
    const args = match[1];
    var result = {};
    if (args.length > 0) {
        args.split(', ').forEach(function(arg) {
            result[arg] = true;
        });
    }
    return result;
}