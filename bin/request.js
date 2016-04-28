"use strict";
var request             = require('request');

module.exports = Request;

function Request(options) {
    return new Promise(function(resolve, reject) {
        const mockResult = Request.mock.execute(options);
        if (mockResult) {
            resolve(mockResult);
        } else {
            request(options, function(err, response, body) {
                if (err) return reject(err);
                return resolve({ response: response, body: body });
            });
        }
    });
}

Request.mock = (function() {
    const factory = {};
    let store = [];

    factory.execute = function(options) {
        for (let i = 0; i < store.length; i++) {
            let item = store[i];
            if (item.filter(options)) {
                if (item.once) store.splice(i, 1);
                return item.response(options);
            }
        }
    };

    factory.off = function(filter) {
        for (let i = 0; i < store.length; i++) {
            if (store[i].filter === filter) {
                store.splice(i, 1);
                return;
            }
        }
    };

    factory.on = function(filter, response) {
        store.push({
            once: false,
            filter: filter,
            response: response
        });
    };

    factory.once = function(filter, response) {
        store.push({
            once: true,
            filter: filter,
            response: response
        });
    };

    factory.reset = function() {
        store = [];
    };

    return factory;
})();