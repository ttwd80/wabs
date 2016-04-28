"use strict";
/**
 * This file provides a logging middleware for the server.
 */
const chalk         = require('chalk');
const onFinished    = require('on-finished');
const onHeaders     = require('on-headers');
const uniqueId      = require('../unique-id');

/**
 * Middleware function for logging request and response data.
 */
module.exports = function() {
    return function log(req, res, next) {
        var bytes = 0;
        var date = new Date();
        var logged = false;
        var received = date.toISOString();
        var redirect = res.redirect;
        var sendStart;
        var start = +date;
        var write = res.write;

        // add a unique ID to the request
        req.id = uniqueId();

        res.logCompleted = function() {
            if (logged) return;
            logged = true;

            var diff;
            var headerBytes = res._header ? res._header.length : 0;
            var load;
            var totalBytes = getMetric(bytes + headerBytes);

            // get the number of bytes and processing time
            diff = '' + ((Date.now() - start) / 1000);
            if (!/\./.test(diff)) diff += '.0';

            console.log(
                chalk.bold('[REQ]') + '  : ' +
                req.id + ' : ' +
                chalk.magenta(received) + ' : ' +
                chalk.cyan(res.statusCode) + ' : ' +
                chalk.green(totalBytes.value + ' ' + totalBytes.unit + 'B') + ' : ' +
                chalk.yellow(addCharacters(diff, '0', true, 5)) + ' : ' +
                chalk.blue(req.url)
            );
        };

        // overwrite the redirect function
        res.redirect = function(url) {
            res.statusCode = 307;
            redirect.apply(res, arguments);
            res.logCompleted();
        };

        // keep track of how many bytes are being written
        res.write = function(chunk) {
            bytes += chunk.length;
            write.apply(res, arguments);
        };

        onHeaders(res, function() {
            sendStart = Date.now() - start;
        });

        onFinished(res, function(err, res) {
            res.logCompleted();
        });

        next();
    };
};

module.exports.getMetric = getMetric;


function getMetric(value) {
    var index = 0;
    var units;
    var val = value;

    units = [' ', 'k', 'M', 'G', 'T'];
    while (val > 1024 && index < units.length) {
        index++;
        val = value / Math.pow(1024, index);
    }

    return {
        unit: units[index],
        value: addCharacters(('' + val).substr(0, 5), ' ', false, 5)
    }
}

function addCharacters(value, ch, after, length) {
    var result = '' + value;
    while (result.length < length) {
        if (after) {
            result += ch;
        } else {
            result = ch + result;
        }
    }
    return result;
}