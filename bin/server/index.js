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
            app.use(brownie(config));               // brownie
            app.use(authenticate(config, stats));   // oAuth
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
    brief: 'Start a static file server or a proxy server that optionally integrates authentication, OAuth, and brownies ' +
        'into a client web application.',
    synopsis: ['[OPTIONS]...'],
    groups: {
        server: 'Server Options',
        auth: {
            title: 'Authentication Options',
            description: 'If you are interested in having this server facilitate authentication and authorization ' +
                '(via OAuth) then you must set the ' + chalk.bold.cyan('authenticate') + ' option to either ' +
                '"manual" or "always".\n\n' +
                chalk.bold('If set to either "manual" or "always"') + ' then all other authentication options are ' +
                'required (except where a default value exist for the option). Also in these modes the client ' +
                'application will automatically have access to additional tools. For details on these tools see the ' +
                'section titled ' + chalk.bold.cyan('Client Application Authentication Tools') + '.\n\n' +
                chalk.bold('If set to "none"') + ' then all other authentication options are ignored and the ' +
                'client application will not have access to the ' + chalk.bold.cyan('Client Application Authentication Tools') + '.'
        },
        brownie: {
            title: 'Brownie Options',
            description: 'If you would like your client applications to have interoperability with legacy code ' +
                '(specifically the BYU-OIT C-framework) then you must set the ' + chalk.bold.cyan('brownie') +
                ' option to either "manual" or "always".\n\n' +
                chalk.bold('If set to either "manual" or "always"') + ' then all other brownie options are required. ' +
                'Also, in these modes the client application will automatically have access to additional tools. ' +
                'For details on these tools see the section titled ' + chalk.bold.cyan('Client Application Brownie Tools') + '.\n\n' +
                chalk.bold('If set to "none"') + ' then all other brownie options are ignored and the client ' +
                'application will not have access to the ' + chalk.bold.cyan('Client Application Brownie Tools') + '.'
        }
    },
    options: Object.assign({}, Server.options, authenticate.options, brownie.options),
    sections: [
        {
            title: 'Client Application Authentication Tools',
            beforeOptions: true,
            body: 'If the ' + chalk.bold.cyan('authenticate') + ' option is set to either "manual" or "always" ' +
                'then your client application will automatically get access to a few additional tools:\n\n' +

                chalk.bold.underline('HTML Meta Tags') + '\n\n' +
                'Set the authenticate mode within the HTML page to either "manual" or "always" using ' +
                chalk.italic('<meta name="wabs-auth" content="manual">') + ' or ' +
                chalk.italic('<meta name="wabs-auth" content="always">') + '\n\n' +
                'Set the authentication auto refresh using ' +
                chalk.italic('<meta name="wabs-auth-refresh" content="0">') + ' where the content value is a number. ' +
                'If the number is zero then authentication auto refresh will be disabled. If the number is positive ' +
                'then the auto refresh will occur number of minutes specified. If the number is negative then the ' +
                'refresh will occur that many number of minutes before the OAuth access token expires.\n\n' +

                chalk.bold.underline('JavaScript') + '\n\n' +
                'Your client application will have access to two global objects:\n\n' +
                chalk.bold.italic('byu.user') + ' will be an object with data about the authenticated user.\n\n' +
                chalk.bold.italic('byu.auth') + ' will have the following properties and functions:\n\n' +

                chalk.bold('accessToken') + ' - ' + chalk.dim('[readonly]') + ' The OAuth access token.\n\n' +

                chalk.bold('autoRefresh') + ' - The authentication auto refresh interval.' +
                'If the number is zero then authentication auto refresh will be disabled. If the number is positive ' +
                'then the auto refresh will occur number of minutes specified. If the number is negative then the ' +
                'refresh will occur that many number of minutes before the OAuth access token expires.\n\n' +

                chalk.bold('expired') + ' - ' + chalk.dim('[readonly]') + ' A boolean indicating whether the OAuth ' +
                'access token has expired.\n\n' +

                chalk.bold('expires') + ' - ' + chalk.dim('[readonly]') + ' The number of milliseconds until the ' +
                'OAuth token expires. Note that this will only be accurate to 60000 milliseconds.' +

                chalk.bold('login()') + ' - A function that takes no parameters and will log the user in.\n\n' +

                chalk.bold('logout([casLogout [, redirect] ])') + ' - A function that will log the user out. ' +
                'This function takes two optional parameters: 1) casLogout - a boolean that specifies whether to ' +
                'perform a CAS logout as well, and 2) redirect - used to specify the URL of where to direct the ' +
                'client after logout. If not specified then the client will be redirected to the current page. ' +
                'If set to false then no redirect will occur \n\n' +

                chalk.bold('refresh([callback])') + ' - A function that will refresh the OAuth access token. This function takes ' +
                'an optional callback function as a parameter and the callback will be called and sent null on success ' +
                'or an Error object on failure.\n\n' +

                chalk.bold('refreshToken') + ' - ' + chalk.dim('[readonly]') + ' The encrypted OAuth refresh token.'
        },
        {
            title: 'Client Application Brownie Tools',
            beforeOptions: true,
            body: 'If the ' + chalk.bold.cyan('brownie') + ' option is set to either "always" or "manual"' +
                'then your client application will automatically get access to a few additional tools:\n\n' +

                chalk.bold.underline('HTML Meta Tags') + '\n\n' +
                'Set the brownie mode within the page to either "manual" or "always" using ' +
                chalk.italic('<meta name="wabs-brownie" content="manual">') + ' or ' +
                chalk.italic('<meta name="wabs-brownie" content="always">') + '\n\n' +

                chalk.bold.underline('JavaScript') + '\n\n' +
                'Your client application will have access to the ' + chalk.bold.italic('byu.brownie') + ' object. ' +
                'This object has the following functions:\n\n' +

                chalk.bold('clear()') + ' - A function that will wipe out the active brownie data.\n\n' +

                chalk.bold('get([key])') + ' - A function to get a brownie value with the key that is specified as the ' +
                'first parameter. If the key is omitted then you will get back a copy of the entire brownie data object.\n\n' +

                chalk.bold('navigateTo(url [, target]') + ' - A function to navigate to a URL and if that URL is a ' +
                'legacy app then send the legacy app the brownie data. This function will automatically be called if ' +
                'the brownie mode is set to "always" and a link is clicked that points to a legacy application.\n\n' +

                chalk.bold('set(key, value)') + ' - A function to set a brownie property to a value. The first parameter is the ' +
                'key and the second parameter is the value.\n\n' +

                chalk.bold('unset(key)') + ' - A function to remove a brownie property value. The first parameter is the key.'
        }
    ]
});

/*
 Additionally, your client application ' +
 'will have access to two global objects ' + chalk.italic('byu.auth') + ' (used to trigger login, ' +
 'logout, and authentication refresh) and ' + chalk.italic('byu.user') + ' (an object with data about ' +
 'the authenticated user). Finally, in these modes you will also have the option to add a meta html ' +
 'tag that can change the mode between "manual" and "always", using ' +
 chalk.italic('<meta name="wabs-auth" content="always">') + ' and you can set a
 */

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
        var filePath = path.resolve(config.src, req.url.substr(1).split('?')[0]);

        // if the file path is a directory then try to get the index file path for that directory
        if (stats.isDirectory(filePath)) filePath = stats.getIndexFilePath(filePath);
        req.filePath = filePath;

        // determine if the file is an app root file
        req.isAppRoot = stats.isAppRoot(filePath);

        // set the auth mode
        req.authMode = stats.authMode(req.filePath);

        // set whether the request is a wabs endpoint
        req.wabsEndpoint = req.url.indexOf(config.endpoint) === 0 ?
            req.url.split('?')[0].substr(config.endpoint.length).replace(/^\//, '').replace(/\/$/, '') :
            false;

        // initialize response wabs object
        res.wabs = {};

        next();
    };
}