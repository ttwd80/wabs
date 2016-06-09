"use strict";
const path          = require('path');

/**
 * Get middleware that will augment the request object.
 * @param {object} config The application configuration object.
 * @returns {Function}
 */
module.exports = function(config) {

    return function init(req, res, next) {

        // add wabs object to request and response objects
        req.wabs = {
            authMode: config.authenticate,
            brownie: null,
            endpoint: false,
            inject: false
        };

        // determine the wabs endpoint if it exists (for wabs specific web services)
        if (req.url.indexOf(config.endpoint) === 0) {
            req.wabs.endpoint = req.url.split('?')[0]
                .substr(config.endpoint.length)
                .replace(/^\//, '')
                .replace(/\/$/, '');
        }

        next();
    };
};