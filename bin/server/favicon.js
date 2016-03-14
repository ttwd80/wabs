"use strict";
const favicon       = require('express-favicon');
const noop          = require('./noop');
const path          = require('path');

module.exports = function() {
    return function(req, res, next) {
        if (!req.proxy && /\/favicon\.ico$/.test(req.url) && req.filePath) {
            res.set('Content-Type', 'image/x-icon');
            res.sendFile(req.filePath);
        } else {
            next();
        }
    };
};