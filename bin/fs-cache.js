"use strict";
const Buffer        = require('buffer');
const path          = require('path');

module.exports = function(config) {
    const factory = {};
    const limit = config.cacheSize * 1000000;
    const extensions = extensionsMap(config.cacheExtensions);
    const store = {};
    let size = 0;

    factory.add = function(filePath, content) {
        const ext = path.extname(filePath);
        if (!extensions.hasOwnProperty(ext)) return;

        const length = getLength(content);
        const newSize = size + length;

        if (newSize > limit) {
            console.error('Cannot cache file "' + filePath + '" because the cache is full.');
        } else {
            store[filePath] = content;
        }
    };

    factory.get = function(filePath) {
        return store.hasOwnProperty(filePath) ? store[filePath] : void 0;
    };

    factory.remove = function(filePath) {
        if (store.hasOwnProperty(filePath)) {
            const length = getLength(store[filePath]);
            size -= length;
            delete store[filePath];
        }
    };

    return factory;
};

function getLength(content) {
    return typeof content === 'string' ? Buffer.byteLength(content) : content.length;
}

function extensionsMap(arr) {
    const o = {};
    arr.forEach(function(key) {
        o[key] = true;
    });
    return o;
}