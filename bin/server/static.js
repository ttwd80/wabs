"use strict";
const crypt         = require('../brownie/crypt');
const brownie       = require('./brownie');
const injector       = require('./injector');
const path          = require('path');
const request       = require('request');

module.exports = function(config, stats) {
    return function(req, res, next) {

        // if not GET or if a wabs endpoint then exit
        if (req.method !== 'GET' || req.wabs.endpoint) return next();

        // local file
        if (req.wabs.fsStat) {

            // if the content is in memory then add standard headers
            if (req.wabs.content) {
                res.set('Accept-Range', 'bytes');
                res.set('Cache-Control', 'public, max-age=0');
                res.set('Content-Type', 'text/html');
                res.set('Last-Modified', req.wabs.fsStat.stats.mtime);
            }

            // send the content
            if (req.wabs.inject) {
                res.sendInjected(req.wabs.content);
            } else if (req.wabs.content) {
                res.send(req.wabs.content);
            } else {
                res.sendFile(req.wabs.fsStat.path);
            }


        // proxied file
        } else if (req.wabs.proxy) {

            // set the headers
            req.wabs.headers.forEach(function (item) {
                res.set(item.key, item.value);
            });

            // send the content
            if (req.wabs.inject) {
                res.sendInjected(req.wabs.content);
            } else {
                res.send(req.wabs.content);
            }

        } else {
            next();
        }
    };
};