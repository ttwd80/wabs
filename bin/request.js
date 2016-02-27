"use strict";
var request             = require('request');

module.exports = function(options) {
    return new Promise(function(resolve, reject) {
        request(options, function(err, response, body) {
            if (err) return reject(err);
            return resolve({ response: response, body: body });
        });
    });
};