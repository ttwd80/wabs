"use strict";
const injector      = require('./injector');
const request       = require('request');

module.exports = function() {
    return function proxy(req, res, next) {

        // if this isn't a proxy request then return now
        if (!req.wabs.proxy) return next();

        // configure the proxy request
        var requestConfig = {
            body: req.body,
            encoding: null,
            headers: req.header,
            method: 'GET',
            qs: req.query,
            url: req.wabs.proxy
        };

        request(requestConfig, function(err, response, body) {
            var contentType;
            var html;

            // if there is an error then pass it on
            if (err) return next(err);

            // analyze headers and store them
            Object.keys(response.headers).forEach(function(key) {
                var value = response.headers[key];

                // store the response header
                req.wabs.headers.push({ key: key, value: value });

                // detect content type header
                if (/^content-type$/i.test(key)) contentType = value;
            });

            // if the content is html then send injected html, otherwise send the content as received
            if (/text\/html/i.test(contentType)) {
                body = body.toString();
                let data = injector.process(body);
                if (data.authMode !== null) req.wabs.authMode = data.authMode;
                req.wabs.content = data.html;
                req.wabs.inject = true;
            } else {
                req.wabs.content = body;
            }

            next();
        });
    }
};