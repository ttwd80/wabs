"use strict";
const chokidar          = require('chokidar');
const CustomError       = require('custom-error-instance');
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
 * @returns {Promise}
 */
module.exports = function(config) {
    var store = {};

    /**
     * Set the stats property for the specified file path and potentially cache content.
     * @params {string} filePath
     * @params {object} stats
     */
    function setStats(filePath, stats) {

        // if the path is not an html file then just cache the stats as is
        if (!stats.isFile() || !/\.html?$/i.test(filePath)) {
            store[filePath] = stats;
            console.log('Registered: ' + filePath);
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
                if (html.length !== content.length) stats.html = html;

                // store the stats object
                store[filePath] = stats;

                console.log('Registered main: ' + filePath);
            });
    }

    return new Promise(function(resolve, reject) {
        fs.stat(config.src, function(err, stats) {
            var factory;
            var promises = [];
            var watchReady = false;

            if (err) return reject(err);
            if (!stats.isDirectory()) return reject(Err('The specified --src must be a directory.'));
            setStats(config.src, stats);

            // use the file watch mapping
            if (config.watch) {
                chokidar.watch(config.src, { alwaysStat: true })
                    .on('add', function(filePath, stats) {
                        var promise = setStats(filePath, stats);
                        if (!watchReady) promises.push(promise);
                    })
                    .on('change', function(filePath, stats) {
                        setStats(filePath, stats);
                    })
                    .on('unlink', function(filePath) {
                        delete store[filePath];
                    })
                    .on('ready', function() {
                        watchReady = true;
                        Promise.all(promises).then(() => resolve(factory), reject);
                    })
                    .on('error', function(err) {
                        reject(err);
                    });

            // use a static mapping
            } else {
                fsMap(config.src)
                    .then(function(data) {
                        var promises = [];
                        Object.keys(data).forEach(function(filePath) {
                            promises.push(setStats(filePath, data[filePath]));
                        });
                        Promise.all(promises).then(() => resolve(factory), reject);
                    }, reject);
            }

            // initialize the factory
            factory = {};

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
                        return filePath.indexOf(directoryPath) === 0 && /index\.html?$/i.test(basename);
                    })[0];
            };

            /**
             * Get the stats object for a specific file path.
             * @param {string} filePath
             * @returns {object}
             */
            factory.get = function(filePath) {
                return store.hasOwnProperty(filePath) ? store[filePath] : null;
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
                var stats = factory.get(filePath);
                return stats ? stats.isDirectory() : false;
            };

            /**
             * Check to see if a path points to a file.
             * @param {string} filePath
             * @returns {boolean}
             */
            factory.isFile = function(filePath) {
                var stats = factory.get(filePath);
                return stats ? stats.isFile() : false;
            };
        });
    });
};

Object.defineProperty(module.exports, 'error', {
    enumerable: true,
    writable: false,
    value: Err
});