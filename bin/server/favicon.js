"use strict";
const favicon       = require('express-favicon');
const noop          = require('./noop');
const path          = require('path');

module.exports = function(config, stats) {
    return config.proxy ? noop : middleware(config, stats);
};

function middleware(config, stats) {
    var faviconPath = path.resolve(config.src, 'favicon.ico');
    if (!stats[faviconPath]) faviconPath = path.resolve(__dirname, '../www/favicon.ico');
    return favicon(faviconPath);
}