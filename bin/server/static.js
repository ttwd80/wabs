"use strict";
const crypt         = require('../brownie/crypt');
const brownie       = require('./brownie');
const injector       = require('./injector');
const path          = require('path');
const request       = require('request');

module.exports = function(config, stats) {
    return stats ? local(config, stats) : proxy(config);
};

function addStandardHeaders(res, fileStat) {
    res.set('Accept-Range', 'bytes');
    res.set('Cache-Control', 'public, max-age=0');
    res.set('Content-Type', 'text/html');
    res.set('Last-Modified', fileStat.mtime);
}

function local(config, stats) {
    return function(req, res, next) {
        var filePath = path.resolve(config.src, req.url.substr(1));
        var fileStat;
        var sent;

        if (req.method === 'GET') {

            // get the file stat
            fileStat = stats.get(req.filePath);

            // if there is a file at the path then process it
            if (fileStat && fileStat.isFile()) {
                if (req.isAppRoot) {
                    addStandardHeaders(res, fileStat);
                    res.sendInjected(fileStat.html);
                    sent = true;
                } else {
                    res.sendFile(filePath);
                    sent = true;
                }
            }
        }

        if (!sent) next();
    }
}

function proxy(config) {
    return function(req, res, next) {
        var requestConfig = {
            body: req.body,
            headers: req.header,
            method: 'GET',
            qs: req.query,
            url: config.src + req.url
        };

        request(requestConfig, function(err, response, body) {
            var contentType;

            // if there is an error then pass it on
            if (err) return next(err);

            // analyze headers and add them to response object
            Object.keys(response.headers).forEach(function(key) {
                var value = response.headers[key];

                // set the response header
                res.set(key, value);

                // detect content type header
                if (/^content-type$/i.test(key)) contentType = value;
            });

            // if the content is html then send injected html, otherwise send the content as received
            if (/text\/html/i.test(contentType)) {
                res.sendInjected(injector.addInjectSpaces(body));
            } else {
                res.send(body);
            }
        });
    }
}