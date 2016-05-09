'use strict';
const endpoint          = require('../endpoint');
const fs                = require('fs');
const path              = require('path');
const Promise           = require('bluebird');
const services          = require('./services');

const readDir = Promise.promisify(fs.readdir);
const stat = Promise.promisify(fs.stat);

module.exports = function(config) {
    "use strict";

    // register the service
    services.register('health', config.endpoint + '/health', 'Get the health of the server');

    return function(req, res, next) {
        if (req.wabs.endpoint === 'health') {
            const endpointMap = endpoint.map(config);
            const promises = [];

            Object.keys(endpointMap).forEach(function(key) {
                const endpoint = endpointMap[key];
                if (!endpoint.proxy) {
                    const promise = endpointHealthy(endpoint.source);
                    promises.push(promise);
                }
            });

            Promise.all(promises)
                .then(function(results) {
                    var sent = false;
                    results.forEach(function(found) {
                        if (!sent && !found) {
                            console.error('Local source directory has no files: ' + endpoint.source);
                            res.status(503).send('Service Unavailable');
                            sent = true;
                        }
                    });
                    if (!sent) res.status(200).send('OK');
                });

        } else {
            next();
        }
    }
};

function endpointHealthy(filePath) {
    const paths = [ filePath ];
    const directories = [];

    function findFirstFile() {
        if (paths.length > 0) {
            const filePath = paths.shift();
            return stat(filePath)
                .then(function(stats) {
                    if (stats.isFile()) return true;
                    if (stats.isDirectory()) directories.push(filePath);
                    return findFirstFile();
                });

        } else if (directories.length > 0) {
            const dirPath = directories.shift();
            return readDir(dirPath)
                .then(function(fileNames) {
                    fileNames.forEach(function(fileName) {
                        const fullFilePath = path.resolve(dirPath, fileName);
                        paths.push(fullFilePath);
                    });
                    return findFirstFile();
                });

        } else {
            return Promise.resolve(false);
        }
    }

    return findFirstFile();
}