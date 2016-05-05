"use strict";
const endpoint      = require('./../endpoint');
const path          = require('path');

/**
 * Get middleware that will augment the request object.
 * @param {object} config The application configuration object.
 * @param {object} cache The file cache factory.
 * @returns {Function}
 */
module.exports = function(config, cache) {
    const endpointMap = endpoint.map(config);
    const endpointKeys = Object.keys(endpointMap);

    // sort endpoint keys by path length, longest first
    endpointKeys.sort(function(a, b) {
        var lenA = a.split('/').length;
        var lenB = b.split('/').length;
        return lenA > lenB ? -1 : 1;
    });

    function getEndpointObject(url) {
        var i;
        var key;
        for (i = 0; i < endpointKeys.length; i++) {
            key = endpointKeys[i];
            if (url.indexOf(key) === 0) return endpointMap[key];
        }
        return null;
    }

    return function init(req, res, next) {
        const urlPath = endpoint.normalize(req.url.split('#')[0].split('?')[0]);
        const match = getEndpointObject(urlPath);

        // add wabs object to request and response objects
        req.wabs = {
            authMode: config.authenticate,
            brownie: null,
            content: null,
            endpoint: false,
            filePath: false,
            headers: [],
            inject: false,
            proxy: false,
            type: null,
            url: req.protocol + '://' + req.get('host') + urlPath
        };

        // determine the wabs endpoint if it exists (for wabs specific web services)
        if (req.url.indexOf(config.endpoint) === 0) {
            req.wabs.endpoint = req.url.split('?')[0]
                .substr(config.endpoint.length)
                .replace(/^\//, '')
                .replace(/\/$/, '');
            next();

        } else if (match && match.proxy) {
            req.wabs.proxy = match.source + '/' + path.relative(match.endpoint, urlPath);
            next();

        } else if (match) {
            cache.get(match.source + urlPath)
                .then(function(data) {
                    req.wabs.fsStat = data;
                    if (data.inject) req.wabs.inject = true;
                    next();
                }, next);
        }
    };
};