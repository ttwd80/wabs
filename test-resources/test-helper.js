"use strict";
const bodyParser        = require('body-parser');
const emptyPort         = require('empty-port');
const express           = require('express');
const Promise           = require('bluebird');

exports.brownieServer = function() {
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

    return exports.server()
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
 * Check to see if a function is a middleware function. It can either have the
 * parameters 'req', 'res', 'next' or 'err', 'res', 'next'.
 * @param callback
 * @returns {boolean}
 */
exports.isMiddlewareFunction = function(callback) {
    return exports.functionHasParameters(['req', 'res', 'next'], callback) ||
        exports.functionHasParameters(['err', 'req', 'res', 'next'], callback);
};

/**
 * Check to see if a function has the specified parameter names.
 * @param {string[]} paramNames
 * @param {function} callback
 * @returns {boolean}
 */
exports.functionHasParameters = function(paramNames, callback) {
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
exports.server = function() {
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