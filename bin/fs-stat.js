"use strict";
const chalk             = require('chalk');
const chokidar          = require('chokidar');
const CustomError       = require('custom-error-instance');
const endpoint          = require('./endpoint');
const fs                = require('fs');
const fsMap             = require('fs-map');
const injector          = require('./server/injector');
const path              = require('path');
const Promise           = require('bluebird');

const Err = CustomError('FsStatError');
const readFile = Promise.promisify(fs.readFile);

/**
 * Returns a promise that resolves to an object.
 * @param {object} config The configuration object used to start the application.
 * @param {object} endpointMap The endpoint map object.
 * @returns {Promise}
 */
module.exports = function(config, endpointMap) {
    var store = statStore();
    var promises = [];

    // build file system maps for all sources
    Object.keys(endpointMap).forEach(function(endpoint) {
        var data = endpointMap[endpoint];
        var promise;
        if (!data.proxy) {
            promise = data.watch ?
                dynamicMap(config, data.source, data.endpoint, store) :
                staticMap(onfig, data.source, data.endpoint, store);
            promises.push(promise);
        }
    });

    // once all file system maps are built then resolve the promise to a controller
    return Promise.all(promises)
        .then(function() {
            var factory = {};

            /**
             * Determine the authentication mode that the file should use.
             * @param {string} filePath
             * @returns {string}
             */
            factory.authMode = function(filePath) {
                var stats = factory.get(filePath);
                return stats ? stats.authMode || config.authenticate : config.authenticate;
            };

            /**
             * From a directory path, get the file path to the index.html or index.htm file.
             * @param {string} directoryPath
             * @returns {string, undefined}
             */
            factory.getIndexFilePath = function(directoryPath) {


                return Object.keys(store)
                    .filter(function(filePath) {
                        var basename = path.basename(filePath);
                        return filePath === directoryPath && /index\.html?$/i.test(basename);
                    })[0];
            };

            /**
             * Get the stats object for a specific file path. It will not get stats for a directory.
             * @param {string} filePath
             * @returns {object}
             */
            factory.get = function(filePath) {
                return store.get(filePath);
            };

            /**
             * Determine if a path is an app root (meaning it has an html body tag).
             * @param filePath
             * @returns {boolean}
             */
            factory.isAppRoot = function(filePath) {
                var stats = factory.get(filePath);
                return stats && stats.html ? true : false;
            };

            /**
             * Check if the specified file path is a directory.
             * @param {string} filePath
             * @returns {boolean}
             */
            factory.isDirectory = function(filePath) {
                return store.data.directories.hasOwnProperty(filePath);
            };

            /**
             * Check to see if a path points to a file.
             * @param {string} filePath
             * @returns {boolean}
             */
            factory.isFile = function(filePath) {
                return store.data.files.hasOwnProperty(filePath);
            };

            return factory;
        });
};

Object.defineProperty(module.exports, 'error', {
    enumerable: true,
    writable: false,
    value: Err
});

/**
 * Bind a dynamic file system map to the store.
 * @param {object} config
 * @param {string} src
 * @param {string} endpoint
 * @param {object} store
 * @returns {Promise}
 */
function dynamicMap(config, src, endpoint, store) {
    return new Promise(function (resolve, reject) {
        var watchReady = false;
        var promises = [];

        // build the choidar configuration object
        var chokConfig = { alwaysStat: true };
        if (config.watchPolling) {
            chokConfig.usePolling = true;
            chokConfig.interval = config.watchPolling;
        }

        chokidar.watch(src, chokConfig)
            .on('add', function(filePath, stats) {
                var promise = store.add(src, filePath, endpoint, stats);
                if (!watchReady) promises.push(promise);
            })
            .on('change', (filePath, stats) => store.update(src, filePath, endpoint, stats))
            .on('unlink', filePath => store.remove(src, filePath, endpoint))
            .on('ready', function() {
                watchReady = true;
                Promise.all(promises).then(resolve, reject);
            })
            .on('error', function(err) {
                reject(err);
            });
    });
}

/**
 * Build a file system map into the store.
 * @param {object} config
 * @param {string} src
 * @param {string} endpoint
 * @param {object} store
 * @returns {Promise}
 */
function staticMap(config, src, endpoint, store) {
    return fsMap(src)
        .then(function(data) {
            var promises = [];
            Object.keys(data).forEach(function(filePath) {
                store.update(src, filePath, endpoint, data[filePath]);
            });
            return Promise.all(promises);
        });
}

/**
 * Get a file system store.
 * @returns {object}
 */
function statStore() {
    var rxIndexHtml = /^index\.html?$/i;
    var rxHtml = /\.html?$/i;
    var store = {
        endpoints: {},
        files: {}
    };

    function fitString(str, length) {
        var newLength;
        if (str.length > length) {
            newLength = Math.floor((length - 3) / 2);
            str = str.substr(0, newLength) + '...' + str.substr(str.length - newLength);
        }
        while (str.length < length) str += ' ';
        return str;
    }

    function getFileKey(endpoint, root, filePath) {
        var relative = path.relative(root, filePath);
        return path.resolve(endpoint, relative);
    }

    function removeEndpoint(endpoint, filePath) {
        var index;

        // remove the actual document file path mapping from the endpoint
        if (store.endpoints.hasOwnProperty(endpoint)) {
            index = store.endpoints[endpoint].indexOf(filePath);
            store.endpoints[endpoint].splice(index, 1);

            console.log(
                chalk.red('[-MAP]') + ' : ' +
                chalk.cyan(fitString(endpoint, 22)) + ' : ' +
                chalk.yellow(filePath)
            );
        }

        // if the endpoint is empty then remove the endpoint
        if (store.endpoints[endpoint].length === 0) delete store.endpoints[endpoint];
    }

    function setEndpoint(endpoint, filePath) {

        // map the endpoint file path to the actual document file path
        if (!store.endpoints.hasOwnProperty(endpoint)) store.endpoints[endpoint] = [];
        store.endpoints[endpoint].push(filePath);

        console.log(
            chalk.green('[+MAP]') + ' : ' +
            chalk.cyan(fitString(endpoint, 22)) + ' : ' +
            chalk.yellow(filePath)
        );

        // notify of conflicting file paths
        if (store.endpoints[endpoint].length > 1) {
            console.warn('Endpoint conflict at ' + endpoint + ' from ' + store.endpoints[endpoint].join(', '));
            store.endpoints[endpoint].sort();
        }
    }

    function updateStore(added, root, filePath, endpoint, stats) {
        var key = getFileKey(endpoint, root, filePath);

        // if it is not a file then return
        if (!stats.isFile()) return Promise.resolve();

        // store the stats object
        store.files[filePath] = stats;

        // if the path is not an html file then just cache the stats as is
        if (!rxHtml.test(filePath)) {
            setEndpoint(key, filePath);
            return Promise.resolve();
        }

        // read the content of the html file
        return readFile(filePath, 'utf8')
            .then(function (content) {
                var data;
                var html;

                // process the html
                data = injector.process(content);
                html = data.html;

                // store authentication mode data
                stats.authMode = data.authMode;

                // if the html was modified then add html to the stats object
                if (data.changed) stats.html = html;

                // set the endpoints
                if (added) {
                    setEndpoint(key, filePath);
                    if (rxIndexHtml.test(path.basename(filePath))) setEndpoint(path.dirname(key), filePath);
                } else {
                    console.log(
                        chalk.blue('[\u00b1MAP]') + ' : ' +
                        chalk.cyan(fitString(endpoint, 22)) + ' : ' +
                        chalk.yellow(filePath)
                    );
                }
            });
    }

    return {

        /**
         * Add a path to the store.
         * @param {string} root
         * @param {string} filePath
         * @param {string} endpoint
         * @param {object} stats
         * @returns {Promise}
         */
        add: function(root, filePath, endpoint, stats) {
            return updateStore(true, root, filePath, endpoint, stats);
        },

        /**
         * Get the file path and stats object for an endpoint path.
         * @param {string} endpoint
         * @returns {{path: string, stats: object}}
         */
        get: function(endpoint) {
            var ar = store.endpoints[endpoint];
            return ar ? { path: ar[0], stats: store.files[ar[0]] } : void 0;
        },

        //data: store,

        /**
         * Remove a path from the store.
         * @param {string} root
         * @param {string} filePath
         * @param {string} endpoint
         */
        remove: function(root, filePath, endpoint) {
            var key = getFileKey(endpoint, root, filePath);
            if (store.files.hasOwnProperty(filePath)) {
                delete store.files[filePath];
                removeEndpoint(key, filePath);
                if (rxIndexHtml.test(path.basename(filePath))) removeEndpoint(key, filePath);
            }
        },

        /**
         * Update a path in the store.
         * @param {string} root
         * @param {string} filePath
         * @param {string} endpoint
         * @param {object} stats
         * @returns {Promise}
         */
        update: function(root, filePath, endpoint, stats) {
            return updateStore(false, root, filePath, endpoint, stats);
        }
    }
}