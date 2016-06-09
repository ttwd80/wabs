"use strict";
/**
 * This file provides a logging middleware for the server.
 */
const chalk         = require('chalk');
const onFinished    = require('on-finished');

/**
 * Middleware function for logging request and response data.
 */
module.exports = function() {
    return function log(req, res, next) {
        var date = new Date();
        var received = date.toISOString();
        var start = +date;

        onFinished(res, function(err, res) {
            console.log(
                chalk.bold('[REQUEST]') + ' : ' +
                chalk.cyan(res.statusCode) + ' : ' +
                chalk.yellow(getSeconds(Date.now() - start)) + ' : ' +
                chalk.blue(req.url)
            );
        });

        next();
    };
};

module.exports.getMetric = getMetric;

module.exports.getMetricString = function(value) {
    const metric = getMetric(value);
    return metric.value + ' ' + metric.unit + 'B'
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

function getSeconds(milliseconds) {
    var seconds = milliseconds / 1000;

    const numeral = Math.floor(seconds);
    const decimalLen = 4 - numeral.toString().length;
    const decimal = addCharacters(Math.round((seconds - numeral) * 1000).toString(), '0', false, 3).substr(0, decimalLen);

    const result = numeral + (decimal.length > 0 ? '.' : ' ') + decimal;

    return result;
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