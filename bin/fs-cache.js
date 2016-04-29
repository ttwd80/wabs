"use strict";
const Buffer        = require('buffer');
const chalk         = require('chalk');
const fs            = require('fs');
const injector      = require('./server/injector');
const log           = require('./server/log');
const mime          = require('mime-types');
const path          = require('path');
const Promise       = require('bluebird');

const readDir = Promise.promisify(fs.readdir);
const readFile = Promise.promisify(fs.readFile);
const stat = Promise.promisify(fs.stat);

const rxIsIndex = /^index\.html?$/i;
const rxIsHtml = /\.html?$/i;

module.exports = fsCache;

function fsCache(config) {
    const factory = {};
    const limit = config.cache * 1000000;
    const extensions = extensionsMap(config.cacheExt.toLowerCase().split(','));
    const maxFileSize = config.cacheMax * 1000;
    const store = {};
    let size = 0;

    // clean cache to below 85% memory cap and at least by quantity specified
    function cleanCache(quantity) {
        const filePaths = Object.keys(store)
            .sort((fp1, fp2) => store[fp1].time < store[fp2].time);
        let removed = 0;
        while (size / limit > .85 || removed < quantity) {
            let filePath = filePaths.shift();
            let length = store[filePath].length;
            size -= length;
            removed += length;
            delete store[filePath];
            if (rxIsIndex.test(path.basename(filePath))) delete store[path.dirname(filePath) + path.sep];
            console.log(chalk.magenta('[CACHE-]') + ' : ' + log.getMetricString(length) + ' : ' + logSize() + ' : ' + filePath);
        }
    }

    // get colored string of cached item
    function logSize() {
        const percent = size / limit;
        let color;
        if (percent < .4) {
            color = 'green';
        } else if (percent < .75) {
            color = 'yellow';
        } else {
            color = 'red';
        }
        return chalk[color](log.getMetricString(size));
    }

    factory.cacheable = function(filePath) {
        const ext = path.extname(filePath).toLowerCase().substr(1);
        return limit !== 0 && extensions.hasOwnProperty(ext);
    };

    factory.get = function(filePath) {

        // path already cached, update time and return value
        if (store.hasOwnProperty(filePath)) {
            store[filePath].time = Date.now();
            return Promise.resolve(store[filePath]);
        }

        return getFilePathData(filePath, maxFileSize)
            .then(function(stats) {
                const content = stats.content;
                const filePath = stats.filePath;
                const data = {
                    content: content,
                    filePath: filePath,
                    mtime: stats.mtime,
                    time: Date.now(),
                    type: mime.lookup(filePath)
                };

                // if the file is an html file then have the injector process it
                if (rxIsHtml.test(filePath)) {
                    const injectorData = injector.process(content.toString());
                    if (injectorData.changed) {
                        data.content = injectorData.html;
                        data.inject = true;
                    }
                    data.authMode = injectorData.authMode;
                }

                // cache data
                if (factory.cacheable(filePath) && stats.size < maxFileSize) {
                    const newSize = size + content.length;

                    if (newSize > limit) cleanCache(content.length);

                    // set data properties that are used for caching.
                    data.length = content.length;

                    // update the size and log it
                    size = newSize;
                    console.log(
                        chalk.cyan('[CACHE+]') + ' : ' +
                        log.getMetricString(content.length) + ' : ' +
                        logSize() + ' : ' + filePath
                    );

                    // cache data and alias data
                    store[filePath] = data;
                    if (rxIsIndex.test(path.basename(filePath))) store[path.dirname(filePath) + path.sep] = data;
                }

                return data;
            }, () => null);
    };

    factory.remove = function(filePath) {
        delete store[filePath];
    };

    return factory;
}

function extensionsMap(arr) {
    const o = {};
    arr.forEach(function(key) {
        o[key] = true;
    });
    return o;
}

function getFilePathData(filePath, maxFileSize) {
    return fileNameAndStat(filePath)
        .then(function(stats) {
            if (stats.isFile()) {
                return stats;
            } else if (!stats.isDirectory()) {
                throw Error('Invalid path. The path must be a file or directory: ' + filePath);
            } else {
                return findIndexFileInDirectory(filePath);
            }
        })
        .then(function(stats) {
            if (stats.size <= maxFileSize) {
                return readFile(stats.filePath)
                    .then(function(content) {
                        stats.content = content;
                        return stats;
                    });
            } else {
                return stats;
            }
        });
}

function findIndexFileInDirectory(dirPath) {
    return readDir(dirPath)
        .then(function(filePaths) {
            const promises = [];
            for (let i = 0; i < filePaths.length; i++) {
                let fileName = filePaths[i];
                let fullPath = path.resolve(dirPath, fileName);
                if (rxIsIndex.test(fileName)) promises.push(fileNameAndStat(fullPath));
            }
            return Promise.all(promises)
                .then(function(results) {
                    for (let i = 0; i < results.length; i++) {
                        if (results[i].isFile()) return results[i];
                    }
                    throw Error('Index file not found in directory: ' + dirPath);
                });
        });
}

function fileNameAndStat(filePath) {
    return stat(filePath)
        .then(function(stats) {
            stats.filePath = filePath;
            return stats;
        });
}