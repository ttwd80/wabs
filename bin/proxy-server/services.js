"use strict";

var store = {};

exports.get = function(key) {
    return arguments.length === 0 ? store : store[key];
};

exports.register = function(key, url, description) {
    store[key] = {
        url: url,
        description: description
    };
};