"use strict";
const path              = require('path');

module.exports = Endpoint;

function Endpoint(config) {
    var map = Endpoint.map(config);

    // throw an error if the config.endpoint matches a src endpoint
    if (map.hasOwnProperty(config.endpoint)) throw Error('Reserved server endpoint conflicts with src endpoint.');

    // return the middleware
    return function (req, res, next) {
        next();
    };
}

/**
 * Get a list of all unique directories from the configuration src.
 * @param {object} config
 * @returns {string[]}
 */
Endpoint.directories = function(config) {
    var unfilteredResults = [];

    // get all local source directories
    config.src.forEach(function(src) {
        var o = evaluateSrc(src, config.watch);
        if (!o.proxy && unfilteredResults.indexOf(o.source) === -1) unfilteredResults.push(o.source);
    });

    // clean up results - removing duplicates, including duplicates via child directories
    return unfilteredResults.filter(function(filePath, index) {
        var i;
        var len;
        var parts = filePath.split(path.sep);
        var str;

        for (len = parts.length - 1; len >= 0; len--) {
            str = parts.slice(0, len).join(path.sep);
            i = unfilteredResults.indexOf(str);
            if (i !== -1 && i !== index) return false;
        }

        return true;
    });
};

/**
 * Generate an endpoint map the maps endpoints to sources.
 * @param {object} config
 * @returns {object}
 */
Endpoint.map = function(config) {
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
Endpoint.normalize = function(endpoint) {
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