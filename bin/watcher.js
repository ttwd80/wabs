"use strict";
const chokidar      = require('chokidar');
const endpoint      = require('./endpoint');
const path          = require('path');

module.exports = function(config, cache) {

    // if watching is off then return now
    if (!config.watch) return;

    // determine which paths to watch then watch them
    const endpointMap = endpoint.map(config);
    Object.keys(endpointMap)
        .reduce(function(store, key) {
            const endpoint = endpointMap[key];
            if (!endpoint.proxy && endpoint.cache) store.push(endpoint.source);
            return store;
        }, [])
        .map(value => value.split(path.sep))
        .filter(function(item, index, arr) {
            for (let i = 0; i < arr.length; i++) {
                if (i !== index && isSubDirectory(arr[i].components, item.components)) return false;
            }
            return true;
        })
        .map(components => components.join(path.sep))
        .forEach(function(dirPath) {
            const options = {};
            if (config.watchPolling) {
                options.usePolling = true;
                options.interval = config.watchPolling;
            }
            if (config.watchIgnore.length > 0) {
                options.ignored = config.watchIgnore;
            }
            chokidar.watch(dirPath, options)
                .on('change', cache.remove)
                .on('unlink', cache.remove);
        });
};

function isSubDirectory(parent, child) {
    if (parent.length < child.length) return false;
    for (let i = 0; i < parent.length; i++) {
        if (parent[i] !== child[i]) return false;
    }
    return true;
}