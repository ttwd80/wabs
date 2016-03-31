"use strict";
const authenticate  = require('./authenticate');
const brownie       = require('./brownie');
const chalk         = require('chalk');
const Command       = require('command-line-callback');
const compression   = require('compression');
const cookieParser  = require('cookie-parser');
const error         = require('./error');
const endpoint      = require('./endpoint');
const express       = require('express');
const favicon       = require('./favicon');
const injector      = require('./injector');
const log           = require('./log');
const fsStat        = require('../fs-stat');
const path          = require('path');
const Promise       = require('bluebird');
const proxy         = require('./proxy');
const request       = require('request');
const schemata      = require('object-schemata');
const staticEp      = require('./static');
const statusView    = require('./view');

module.exports = Server;

/**
 * Tell the server to start with the specified configuration.
 * @params {object} [config]
 **/
function Server(config) {
    var app = express();

    // handle optional config parameter
    if (!config || typeof config !== 'object') config = {};
    if (!config.hasOwnProperty('port')) config.port = Server.options.port.defaultValue;

    app.use(Server.middleware(config));
    
    return new Promise(function(resolve, reject) {
        app.listen(config.port, function(err) {
            if (err) {
                console.error('Could not listen on port ' + config.port + '. ' + err.message);
                reject(err);
            } else {
                console.log('Server listening on port ' + config.port);
                resolve()
            }
        });
    });
}

Server.middleware = function(config) {

    // normalize the configuration
    const options = Object.assign({}, Server.options, authenticate.options, brownie.options);
    delete options.port;
    config = schemata(options).normalize(config);

    // define the middleware
    const mid = {
        authenticate:   null,
        brownie:        brownie(config),
        compression:    compression({}),
        cookieParser:   cookieParser(),
        error:          error,
        favicon:        null,
        init:           null,
        injector:       injector(config),
        log:            log(),
        proxy:          proxy(),
        static:         null,
        statusView:     statusView(config),
        unhandled:      unhandled
    };

    // map endpoints
    const endpointMap = endpoint.map(config);

    // define the initial middleware array
    var middleware = [ function(req, res, next) {
        mid.statusView(req, res, function(err) {
            if (err) return next(err);
            res.sendStatusView(503, 'Initializing Web Application Bootstrap Server Middleware');
        });
    }];

    // normalize the endpoint
    config.endpoint = endpoint.normalize(config.endpoint);

    // start file system mapping
    fsStat(config, endpointMap)
        .then(function(stats) {

            // fill in the middleware
            mid.authenticate = authenticate(config, stats);
            mid.favicon = favicon(stats);
            mid.init = init(config, endpointMap, stats);
            mid.static = staticEp(config, stats);

            // overwrite the initial middleware array
            middleware = [
                mid.statusView,
                mid.log,
                mid.compression,
                mid.init,
                mid.favicon,
                mid.cookieParser,
                mid.brownie,
                mid.proxy,
                mid.authenticate,
                mid.injector,
                mid.static,
                mid.unhandled,
                mid.error
            ];
        });

    // return a middleware function
    return function(req, res, next) {
        const chain = middleware.slice(0);

        function handle(req, res, next) {
            var active = chain.shift();
            if (!active) return next();
            active(req, res, function(err) {
                if (err) return next(err);
                handle(req, res, next);
            });
        }

        handle(req, res, next);
    };
};

Server.options = {
    development: {
        alias: 'd',
        description: 'Set the server into development mode, removing optimizations while improving the ability to debug.',
        type: Boolean,
        group: 'server'
    },
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
        description: 'Specify a source to serve files from. This can be either a file system path or the URL for ' +
            'another server to proxy requests for. You can also optionally specify the endpoint from which those ' +
            'resources should be available by specifying the path followed by ":" followed by the endpoint. ' +
            'If the endpoint is not specified then "/" is assumed.\n\n' +
            chalk.bold('Example: Proxy with Default Endpoint:') + '\n--src http://someserver.com/\n\n' +
            chalk.bold('Example: Local Path with Default Endpoint:') + '\n--src ./src-directory\n\n' +
            chalk.bold('Example: Multiple Sources with Custom Endpoints:') +
            '\n--src ./src:/ --src ./bower-components:/components --src http://someserver.com/:/proxy',
        type: String,
        multiple: true,
        defaultValue: './:/',
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
            title: 'Authentication / Authorization Options',
            description: 'If you are interested in having this server facilitate authentication and authorization ' +
                '(via OAuth) then you must set the ' + chalk.bold.cyan('authenticate') + ' option to either ' +
                '"manual" or "always".\n\n' +
                chalk.bold('If set to either "manual" or "always"') + ' then all other authentication / authorization options are ' +
                'required (except where a default value exist for the option). Also in these modes the client ' +
                'application will automatically have access to additional tools. For details on these tools see the ' +
                'section titled ' + chalk.bold.cyan('Client Application Authentication / Authorization Tools') + '.\n\n' +
                chalk.bold('If set to "none"') + ' then all other authentication options are ignored and the ' +
                'client application will not have access to the ' + chalk.bold.cyan('Client Application Authentication / Authorization Tools') + '.'
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
            title: 'Client Application Authentication / Authorization Tools',
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

/**
 * Get middleware that will augment the request object.
 * @param {object} config The application configuration object.
 * @param {object} endpointMap The endpoint map object.
 * @param {object} stats The file stats object.
 * @returns {Function}
 */
function init(config, endpointMap, stats) {
    var endpointKeys = Object.keys(endpointMap);

    // sort endpoint keys by path length, longest first
    endpointKeys.sort(function(a, b) {
        var lenA = a.split('/').length;
        var lenB = b.split('/').length;
        return lenA > lenB ? -1 : 1;
    });

    function getEndpointObject(url) {
        var i;
        var key;
        for (i = 0; i < endpointKeys.length; i++) {
            key = endpointKeys[i];
            if (url.indexOf(key) === 0) return endpointMap[key];
        }
        return null;
    }

    return function init(req, res, next) {
        var urlPath = endpoint.normalize(req.url.split('#')[0].split('?')[0]);
        var match = getEndpointObject(urlPath);

        // add wabs object to request and response objects
        req.wabs = {
            authMode: config.authenticate,
            brownie: null,
            content: null,
            endpoint: false,
            filePath: false,
            headers: [],
            inject: false,
            proxy: false,
            type: null,
            url: req.protocol + '://' + req.get('host') + urlPath
        };

        // determine the wabs endpoint if it exists
        if (req.url.indexOf(config.endpoint) === 0) {
            req.wabs.endpoint = req.url.split('?')[0]
                .substr(config.endpoint.length)
                .replace(/^\//, '')
                .replace(/\/$/, '');

        } else if (match && match.proxy) {
            req.wabs.proxy = match.source + '/' + path.relative(match.endpoint, urlPath);

        } else if (match) {
            req.wabs.fsStat = stats.get(urlPath);
            if (req.wabs.fsStat && req.wabs.fsStat.stats && req.wabs.fsStat.stats.html) {
                req.wabs.content = req.wabs.fsStat.stats.html;
                req.wabs.inject = true;
            }
        }

        next();
    };
}

function unhandled(req, res, next) {
    if (req.method !== 'GET') {
        res.sendStatusView(405);
    } else {
        res.sendStatusView(404);
    }
}