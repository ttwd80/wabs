"use strict";
const cheerio           = require('cheerio');
const chokidar          = require('chokidar');
const CustomError       = require('custom-error-instance');
const fs                = require('fs');
const fsMap             = require('fs-map');
const path              = require('path');
const Promise           = require('bluebird');

const Err = CustomError('FsStatError');
const readFile = Promise.promisify(fs.readFile);

/**
 * Returns a promise that resolves to an object.
 * @param {string} srcDirectory The src directory containing the static files.
 * @param {boolean} watch Set to true to watch files for changes.
 * @param {string} endpoint The URL end point for the WABS requests.
 * @returns {Promise}
 */
module.exports = function(srcDirectory, watch, endpoint) {
    var store = {};

    /**
     * Set the stats property for the specified file path and potentially cache content.
     * @params {string} filePath
     * @params {object} stats
     */
    function setStats(filePath, stats) {

        // if the path is not for an app root (meaning it has an html body tag) the just cache the stats as is
        if (!stats.isFile() || !/\.html?$/i.test(filePath)) {
            store[filePath] = stats;
            console.log('Registered: ' + filePath);
            return Promise.resolve();
        }

        // if the file path is for an app root (meaning it has an html body tag) then read it, modify it, and cache it
        return readFile(filePath, 'utf8')
            .then(function (content) {
                var $ctrl = cheerio.load(content);
                if ($ctrl('body').length > 0) {
                    $ctrl('body').append('<script src="' + endpoint + '/wabs.js"></script>'); // data injected by cookie
                    stats.html = $ctrl.html();
                }
                store[filePath] = stats;
                console.log('Registered main: ' + filePath);
            });
    }

    return new Promise(function(resolve, reject) {
        fs.stat(srcDirectory, function(err, stats) {
            var factory;
            var promises = [];
            var watchReady = false;

            if (err) return reject(err);
            if (!stats.isDirectory()) return reject(Err('The specified --src must be a directory.'));
            setStats(srcDirectory, stats);

            // use the file watch mapping
            if (watch) {
                chokidar.watch(srcDirectory, { alwaysStat: true })
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
                fsMap(srcDirectory)
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
                return stats && stats.html;
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