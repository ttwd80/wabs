"use strict";
const path              = require('path');

/**
 * Generate an endpoint map the maps endpoints to sources.
 * @param {object} config
 * @returns {object}
 */
exports.map = function(config) {
    var map = {};

    // build file system maps for all sources
    config.src.forEach(function (src) {
        var endpoint;
        var isProxy = false;
        var match;
        var parts;
        var rxHttpProxy = /(^https?:\/\/[\s\S]+?(?::\d+[\s\S]*?)?)(?::|$)/;
        var source;
        var watch = config.watch;

        // determine if the source is a url to proxy
        match = rxHttpProxy.exec(src);

        // if a url to proxy
        if (match) {
            source = match[1].replace(/\/$/, '');
            endpoint = src.substr(source.length + 2).split(':')[0];
            watch = false;
            isProxy = true;

        // local file system
        } else {
            parts = src.split(':');
            source = path.resolve(process.cwd(), parts[0]).replace(/\/$/, '');
            endpoint = parts[1] || '';
            if (parts.length === 3) watch = /true|1/i.test(parts[2]);
        }

        // normalize the endpoint
        endpoint = exports.normalize(endpoint);

        console.log('Endpoint ' + endpoint + ' maps to source ' + source + ' ' + (watch ? 'with': 'without') + ' watch');

        map[endpoint] = {
            endpoint: endpoint,
            proxy: isProxy,
            source: source,
            watch: watch
        };
    });

    return map;
};

/**
 * Take an endpoint and normalize it to start with a slash and not end with a slash.
 * @param {string} endpoint
 * @returns {string}
 */
exports.normalize = function(endpoint) {
    return '/' + endpoint.replace(/^\//, '').replace(/\/$/, '');
};