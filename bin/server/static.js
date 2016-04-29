"use strict";
const crypt         = require('../brownie/crypt');
const brownie       = require('./brownie');
const injector      = require('./injector');
const path          = require('path');
const request       = require('request');

module.exports = function(config, stats) {
    return function view(req, res, next) {

        // if not GET or if a wabs endpoint then exit
        if (req.method !== 'GET' || req.wabs.endpoint) return next();

        // local file
        if (req.wabs.fsStat) {

            // add standard headers
            res.set('Accept-Range', 'bytes');
            res.set('Cache-Control', 'public, max-age=0');
            if (req.wabs.fsStat.type) res.set('Content-Type', req.wabs.fsStat.type);
            res.set('Last-Modified', req.wabs.fsStat.mtime);

            // if the file was not too large then send it's content
            if (req.wabs.fsStat.content) {
                if (req.wabs.fsStat.inject) {
                    res.sendInjected(req.wabs.fsStat.content);
                } else {
                    res.send(req.wabs.fsStat.content);
                }

            // if the file is too large then stream the result
            } else {
                if (req.wabs.fsStat.inject) {
                    res.sendInjectedFile(req.wabs.fsStat.filePath);
                } else {
                    res.sendFile(req.wabs.fsStat.filePath);
                }
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