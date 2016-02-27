"use strict";
/**
 * This file provides a logging middleware for the server.
 */
const activity      = require('./active-requests');
const chalk         = require('chalk');
const onFinished    = require('on-finished');
const onHeaders     = require('on-headers');
const uniqueId      = require('../unique-id');

/**
 * Middleware function for logging request and response data.
 * @param req
 * @param res
 * @param next
 */
module.exports = function(req, res, next) {
    var bytes = 0;
    var date = new Date();
    var key;
    var loadStart = activity.load();
    var received = date.toISOString();
    var sendStart;
    var start = +date;
    var write = res.write;

    // add a unique ID to the request
    req.id = uniqueId();

    // keep track of how many bytes are being written
    res.write = function(chunk) {
        bytes += chunk.length;
        write.apply(res, arguments);
    };

    // store the log data until the request completes
    key = activity.add(res);

    onHeaders(res, function() {
        sendStart = Date.now() - start;
    });

    onFinished(res, function(err, res) {
        var diff;
        var load;
        var totalBytes = getMetric(bytes + res._header.length);

        // get the number of bytes and processing time
        diff = '' + ((Date.now() - start) / 1000);
        if (!/\./.test(diff)) diff += '.0';

        // remove request from activity and get average load
        activity.remove(key);
        load = Math.round((loadStart + activity.load()) / 2);

        console.log(
            req.id + ' : ' +
            chalk.magenta(received) + ' : ' +
            chalk.cyan(res.statusCode) + ' : ' +
            chalk.green(totalBytes.value + ' ' + totalBytes.unit + 'B') + ' : ' +
            chalk.yellow(addCharacters(diff, '0', true, 5)) + ' : ' +
            chalk.blue(req.url)
        );
    });

    next();
};

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