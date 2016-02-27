"use strict";
const auth          = require('./auth/auth-endpoint');
const bodyParser    = require('body-parser');
const brownie       = require('./brownie/brownie-endpoint');
const cookieParser  = require('cookie-parser');
const express       = require('express');
const logMiddleware = require('./metrics/log');
const fsStat        = require('./fs-stat');
const path          = require('path');
const Promise       = require('bluebird');
const request       = require('request');
const staticEp      = require('./static-endpoint');
const view          = require('./status-view/view');

/**
 * Tell the server to start with the specified configuration.
 *
 **/
exports.start = function(config) {
    var cFrameworkFormParser;
    var srcDirectory = path.resolve(process.cwd(), config.src);
    var wabsPath = '/' + config.endpoint.replace(/^\//, '');

    // define the urlEncoded parser middleware that will be used to parse POST data from the c-framework
    cFrameworkFormParser = bodyParser.urlencoded({
        extended: false,
        type: '*/x-www-form-urlencoded'
    });

    console.log('Using static file directory: ' + srcDirectory);

    return fsStat(srcDirectory, config.watchSrc, wabsPath)
        .then(function(stats) {
            var app;

            // create the express app
            app = express();

            // enable the logger middleware for all routes
            app.use(logMiddleware);

            // enable use of the cookie parser for all routes
            app.use(cookieParser());

            // add the status-view middleware for all routes
            app.use(view(config.statusTemplate));

            // handle request intended for the wabs
            app.put(wabsPath + '/brownie/encode', bodyParser.json(), brownie.encode); // this service is used by the client brownie script within the SPA
            app.put(wabsPath + '/login', auth.login); // this service is intended to be used by the SPA
            app.put(wabsPath + '/logout', auth.logout); // this service is intended to be used by the SPA

            // if the c-framework posts here then attempt to decode the brownie
            app.post('*', cFrameworkFormParser, staticEp(srcDirectory, stats));

            // handle all other requests as requests for a static file
            app.all('*', staticEp(srcDirectory, stats));

            // start the server listening on a port
            return startServer(app, config.port);
        });
};

exports.options = [
    {
        name: 'authenticate',
        alias: 'a',
        description: 'Include this flag to enable manual authentication (as opposed to forced authentication). ' +
        'This is useful if you have one or more pages in your application that do not require authentication.\n\n' +
        'Manual authentication can be triggered from the web application by navigating to the endpoint /wabs/login ' +
        'and logout by going to /wabs/logout. Note that changing the endpoint option will also affect these ' +
        'endpoint urls.\n\n',
        type: Boolean
    },
    {
        name: 'client-id',
        alias: 'i',
        description: 'The client ID to use to obtain OAuth tokens.\n\n',
        type: String
    },
    {
        name: 'endpoint',
        alias: 'e',
        description: 'The endpoint for the web application bootstrap server\'s services. Static files that ' +
        'fall within this path will not be served. Defaults to /wabs\n\n',
        type: String,
        defaultValue: '/wabs'
    },
    {
        name: 'help',
        alias: 'h',
        description: 'Get using help for this application.\n\n',
        type: Boolean
    },
    {
        name: 'port',
        alias: 'p',
        description: 'The port number to start the server on.\n\n',
        type: Number,
        defaultValue: 9000
    },
    {
        name: 'src',
        alias: 's',
        description: 'The directory containing the static files to serve.\n\n',
        type: String,
        defaultValue: './'
    },
    {
        name: 'status-template',
        alias: 't',
        description: 'The file path to the html file that should be used as the status template. The status ' +
        'template will be used to show generic status pages. Text with {{status}}, {{title}}, {{body}}, and ' +
        '{{id}} will be replaced with the status code, title, body, and request ID respectively.\n\n',
        type: String
    },
    {
        name: 'watch-src',
        alias: 'w',
        description: 'Set this flag to watch the static file directory for changes.',
        type: Boolean
    }
];

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