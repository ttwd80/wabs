const endpoint      = require('./../endpoint');

/**
 * Get middleware that will augment the request object.
 * @param {object} config The application configuration object.
 * @param {object} endpointMap The endpoint map object. Set to falsy to get a new endpoint map.
 * @param {object} stats The file stats object.
 * @returns {Function}
 */
module.exports = function(config, endpointMap, stats) {
    if (!endpointMap) endpointMap = endpoint.map(config);
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
        var urlPath = endpoint.normalize(req.url.split('#')[0].split('?')[0]);
        var match = getEndpointObject(urlPath);

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

        // determine the wabs endpoint if it exists
        if (req.url.indexOf(config.endpoint) === 0) {
            req.wabs.endpoint = req.url.split('?')[0]
                .substr(config.endpoint.length)
                .replace(/^\//, '')
                .replace(/\/$/, '');

        } else if (match && match.proxy) {
            req.wabs.proxy = match.source + '/' + path.relative(match.endpoint, urlPath);

        } else if (match) {
            req.wabs.fsStat = stats.get(urlPath);
            if (req.wabs.fsStat && req.wabs.fsStat.stats && req.wabs.fsStat.stats.html) {
                req.wabs.content = req.wabs.fsStat.stats.html;
                req.wabs.inject = true;
            }
        }

        next();
    };
};