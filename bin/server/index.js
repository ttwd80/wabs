"use strict";
const authenticate  = require('./authenticate');
const bodyParser    = require('body-parser');
const brownie       = require('./brownie');
const chalk         = require('chalk');
const Command       = require('command-line-callback');
const compression   = require('compression');
const cookieParser  = require('cookie-parser');
const error         = require('./error');
const express       = require('express');
const favicon       = require('./favicon');
const injector      = require('./injector');
const log           = require('./log');
const fsStat        = require('../fs-stat');
const path          = require('path');
const Promise       = require('bluebird');
const request       = require('request');
const staticEp      = require('./static');
const statusView    = require('./view');

module.exports = Server;

/**
 * Tell the server to start with the specified configuration.
 * @params {object} config
 **/
function Server(config) {
    var cFrameworkFormParser;
    var proxy;
    var srcPromise;

    // make sure that the endpoint starts with a slash
    config.endpoint = '/' + config.endpoint.replace(/^\//, '');

    // define the urlEncoded parser middleware that will be used to parse POST data from the c-framework
    cFrameworkFormParser = bodyParser.urlencoded({
        extended: false,
        type: '*/x-www-form-urlencoded'
    });

    // determine whether the src is a separate static file server or a local file system
    if (/^https:\/\//.test(config.src)) {
        config.proxy = true;
        console.log('Serving files from: ' + config.src);
        srcPromise = Promise.resolve();
    } else {
        config.proxy = false;
        config.src = path.resolve(process.cwd(), config.src);
        console.log('Serving files from: ' + config.src);
        srcPromise = fsStat(config);
    }

    return srcPromise
        .then(function(stats) {
            var app;

            // create the express app
            app = express();

            // add middleware
            app.use(log);                           // logging
            app.use(compression({}));               // gzip
            app.use(favicon(config, stats));        // favicon
            app.use(init(config, stats));           // response setup
            app.use(cookieParser());                // cookies
            app.use(statusView(config));            // status code views
            app.use(authenticate(config, stats));   // oAuth
            app.use(brownie(config));               // brownie
            app.use(injector(config));              // injector
            app.use(staticEp(config, stats));       // static files
            app.use(unhandled);                     // handle unhandled requests
            app.use(error);                         // error catching

            // start the server listening on a port
            return startServer(app, config.port);
        });
}

Server.options = {
    endpoint: {
        alias: 'e',
        description: 'The endpoint for the web application bootstrap server\'s services. Static files that ' +
        'fall within this path will not be served.',
        type: String,
        defaultValue: '/wabs',
        group: 'server'
    },
    port: {
        alias: 'p',
        description: 'The port number to start the server on.',
        type: Number,
        defaultValue: 9000,
        group: 'server'
    },
    src: {
        alias: 's',
        description: 'This can be either a URL to proxy requests to or a file system directory containing ' +
        'the static files to serve.',
        type: String,
        defaultValue: './',
        group: 'server'
    },
    statusView: {
        alias: 'v',
        description: 'The file path to the html file that should be used as the status template. The status ' +
        'template will be used to show generic status pages. Text with {{status}}, {{title}}, {{body}}, and ' +
        '{{id}} will be replaced with the status code, title, body, and request ID respectively. If the ' +
        'server is acting as a proxy then status views will not display, instead the response from the proxied ' +
        'server will be sent.',
        type: String,
        group: 'server'
    },
    watch: {
        alias: 'w',
        description: 'If the src is pointing to a file system then this option is used to specify whether ' +
        'the file system should be watched for changes. It is recommended that for development this be set to ' +
        'true and for immutable production instances that it be set to false.',
        type: Boolean,
        defaultValue: true,
        group: 'server'
    }
};

Command.define('server', Server, {
    brief: 'Start a static file server or a proxy server that integrates brownies and authentication.',
    synopsis: ['[OPTIONS]...'],
    groups: {
        server: 'Server Options',
        auth: {
            title: 'Authentication Options',
            description: 'For each of the options below (except the authenticate option), if the authenticate option ' +
                'is set to "none" then all other options within this group will be ignored.'
        },
        brownie: {
            title: 'Brownie Options',
            description: 'For each of the options below (except the brownie option), if the brownie option is set ' +
                'to "none" then all other options within this group will be ignored.'
        }
    },
    options: Object.assign({}, Server.options, authenticate.options, brownie.options)
});

function startServer(app, port) {
    return new Promise(function(resolve, reject) {
        app.listen(port, function(err) {
            if (err) {
                console.error('Could not listen on port ' + port + '. ' + err.message);
                reject(err);
            } else {
                console.log('Server listening on port ' + port);
                resolve()
            }
        });
    });
}

function unhandled(req, res, next) {
    if (req.method !== 'GET') {
        res.sendStatusView(405);
    } else {
        res.sendStatusView(404);
    }
}

function init(config, stats) {
    return function(req, res, next) {
        var filePath = path.resolve(config.src, req.url.substr(1));

        // if the file path is a directory then try to get the index file path for that directory
        if (stats.isDirectory(filePath)) filePath = stats.getIndexFilePath(filePath);
        req.filePath = filePath;

        // determine if the file is an app root file
        req.isAppRoot = stats.isAppRoot(filePath);

        // set whether the request is a wabs endpoint
        req.wabsEndpoint = req.url.indexOf(config.endpoint) === 0 ?
            req.url.split('?')[0].substr(config.endpoint.length).replace(/^\//, '').replace(/\/$/, '') :
            false;

        // initialize response wabs object
        res.wabs = {};

        next();
    };
}