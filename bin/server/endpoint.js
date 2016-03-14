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
        var o = evaluateSrc(src, config.watch);
        map[o.endpoint] = o;
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

/**
 * Evaluate an src string to determine what the endpoint, watch, and src paths are
 * @param {string} src
 * @param {boolean} defaultWatch
 * @returns {{endpoint: string, proxy: boolean, source: string, watch: boolean}}
 */
function evaluateSrc(src, defaultWatch) {
    var endpoint;
    var isProxy = false;
    var match;
    var parts;
    var rxHttpProxy = /(^https?:\/\/[\s\S]+?(?::\d+[\s\S]*?)?)(?::|$)/;
    var source;
    var watch = defaultWatch;

    // determine if the source is a url to proxy
    match = rxHttpProxy.exec(src);

    // if a url to proxy
    if (match) {
        source = match[1];
        endpoint = src.substr(source.length + 1).split(':')[0];
        watch = false;
        isProxy = true;

        // local file system
    } else {
        parts = src.split(':');
        source = path.resolve(process.cwd(), parts[0]);
        endpoint = parts[1] || '';
        if (parts.length === 3) watch = /true|1/i.test(parts[2]);
    }

    // normalize the endpoint
    endpoint = Endpoint.normalize(endpoint);

    return {
        endpoint: endpoint,
        proxy: isProxy,
        source: source,
        watch: watch
    }
}