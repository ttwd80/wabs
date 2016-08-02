'use strict';
const chalk             = require('chalk');
const harmon            = require('harmon');
const httpProxy         = require('http-proxy');
const path              = require('path');

module.exports = function(config) {
    const endpoints = getEndpoints(config);
    const proxies = {};

    // get a meta tag generator representing brownie state
    const brownieMeta = function(req, res) {
        if (config.brownie !== 'none') {
            return getMetaTag('wabs-brownie-data', {
                mode: config.brownie === 'always' ? 'auto' : 'manual',
                store: req.wabs.brownie
            });
        } else {
            return '<meta name="wabs-brownie-data" content="">';
        }
    };

    // determine the script to add to the file
    const wabScript = '<script src="' + config.endpoint + '/wabs.js"></script>';

    // define html injections
    const append = appendToElementMiddleware({
        head: [ brownieMeta ],
        body: [ wabScript ]
    });

    // define the proxies
    endpoints.forEach(function(item) {
        const proxy = httpProxy.createProxyServer({ target: item.source, ws: true });
        proxy.on('error', function(err, req, res) {
            if (err.message !== 'socket hang up') console.error(err.message);
            if (!res.headersSent) {
                res.status(500);
                res.set('content-type', 'text/plain');
                res.send('Internal server error');
                res.setHeader('Host', extract_hostname(item.source));
            } else {
                res.end();
            }
        });
        proxies[item.endpoint] = proxy;
    });

    return function(req, res, next) {
        const route = normalize(req.url);
        var i;
        var item;
        var match;

        // attempt to find the proxy assigned to this route
        for (i = 0; i < endpoints.length; i++) {
            item = endpoints[i];
            if (route.indexOf(item.endpoint) === 0) {
                match = item;
                break;
            }
        }

        if (match) {
            req.url = req.url.substr(match.endpoint.length);
            append(req, res, function(err) {
                if (err) return next(err);
                proxies[match.endpoint].web(req, res);
            });

        } else {
            next();
        }
    };
};

/**
 * Take a map of css selectors to an array of transformation values and return middleware that will append the
 * values to elements matching the selectors. If a value is a string then that value is appended. If the value
 * is a function then the function receives the request and response objects as parameters and must return a
 * string that will be appended.
 * @param {object} config
 * @returns {function}
 */
function appendToElementMiddleware(config) {
    var req;
    var res;

    // build the response selectors array
    const selectors = [];
    Object.keys(config)
        .forEach(function(selector) {
            const content = config[selector];
            selectors.push({
                query: selector,
                func: function(node) {
                    const stream = node.createStream();
                    const rxIndent = /^\n(\s+)/;
                    var indent = '';
                    var indent2 = '';
                    var html = '';

                    stream.on('data', function(data) {
                        const match = rxIndent.exec(data);
                        if (match) {
                            indent = indent2;
                            indent2 = match[1];
                        }
                        html += data;
                    });

                    stream.on('end', function() {
                        content.forEach(function(c) {
                            if (typeof c === 'function') c = c(req, res);
                            html += indent.substr(indent2.length) + c + '\n' + indent2;
                        });
                        stream.end(html);
                    });
                }
            })
        });

    const mw = harmon([], selectors, true);

    return function(request, response, next) {
        req = request;
        res = response;
        mw(request, response, next);
    }
}

/**
 * Get a function that will match an endpoint to a source.
 * @param {object} config
 * @returns {object[]}
 */
function getEndpoints(config) {
    const endpoints = [];

    // build file system maps for all sources
    config.src.forEach(function (src) {
        var endpoint;
        var match;
        var rxHttpProxy = /(^https?:\/\/[\s\S]+?(?::\d+[\s\S]*?)?)(?::|$)/;
        var source;

        // determine if the source is a url to proxy
        match = rxHttpProxy.exec(src);

        // valid proxy url
        if (match) {
            source = match[1].replace(/\/$/, '');
            endpoint = src.substr(source.length + 1);
        } else {
            console.error('Invalid proxy url specified: ' + src);
        }

        // normalize the endpoint
        endpoint = normalize(endpoint);

        // log the mapping
        console.log(chalk.bold('[SRCMAP]') + ' : ' + endpoint + ' => ' + source);

        // store the endpoint
        endpoints.push({ endpoint: endpoint, source: source, length: endpoint.replace(/\/+$/, '').split('/').length });
    });

    // sort endpoints - longest paths first
    endpoints.sort(function(a, b) {
        return a.length < b.length ? 1 : -1;
    });

    return endpoints;
}

/**
 * Get an HTML meta tag that store an object.
 * @param name
 * @param content
 * @returns {string}
 */
function getMetaTag(name, content) {
    content = encodeURIComponent(JSON.stringify(content));
    return '<meta name="' + name + '" content="' + content + '">';
}

/**
 * Take an endpoint and normalize it to start with a slash and not end with a slash.
 * @param {string} endpoint
 * @returns {string}
 */
function normalize(endpoint) {
    return '/' + endpoint.split(/\?|#/)[0].replace(/^\//, '').replace(/\/$/, '');
}
