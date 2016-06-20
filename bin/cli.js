'use strict';
const chalk         = require('chalk');
const Command       = require('command-line-callback');
const Server        = require('./proxy-server/index');

const AuthenticateOptions = {
    consumerKey: {
        alias: 'i',
        description: 'The consumer key from the application defined in WSO2. This value must be set if the ' +
            chalk.italic('--consumer-secret') + ' or ' + chalk.italic('--encrypt-secret') + ' option is set.',
        type: String,
        env: 'WABS_CONSUMER_KEY',
        group: 'auth'
    },
    consumerSecret: {
        alias: 't',
        description: 'The consumer secret from the application defined in WSO2. This value must be set if the ' +
            chalk.italic('--consumer-key') + ' or ' + chalk.italic('--encrypt-secret') + ' option is set.',
        type: String,
        env: 'WABS_CONSUMER_SECRET',
        group: 'auth'
    },
    encryptSecret: {
        alias: 'n',
        description: 'The encryption secret to use to encrypt and decrypt the refresh token that is sent to the client. ' +
            chalk.italic('--consumer-key') + ' or ' + chalk.italic('--encrypt-secret') + ' option is set.',
        type: String,
        env: 'WABS_ENCRYPT_SECRET',
        group: 'auth'
    },
    host: {
        alias: 'h',
        description: 'The full host name including protocol and port number that will be used to reach this server. ' +
            'If not specified then the server will automatically attempt to determine this information, but if the ' +
            'server is behind a proxy then it will be incorrect.',
        type: String,
        defaultValue: '',
        env: 'WABS_HOST',
        group: 'auth'
    },
    wellKnownUrl: {
        alias: 'k',
        description: 'The well known URL to use to get authentication information from.',
        type: String,
        defaultValue: 'https://api.byu.edu/.well-known/openid-configuration',
        env: 'WABS_WELL_KNOWN_URL',
        group: 'auth'
    }
};

const BrownieOptions = {
    brownie: {
        alias: 'b',
        description: 'Specify the level of brownie support. Valid values include ' +
            '"' + ['none', 'manual', 'always'].join('", "') + '". \n\n' +
            chalk.bold.green('none') + ': Will not provide brownie support.\n\n' +
            chalk.bold.green('manual') + ': Will provide brownie data and the library but will not automatically ' +
            'trigger brownie data transfer when navigating to a legacy application.\n\n' +
            chalk.bold.green('always') + ': Will provide full brownie support and will automatically cause links that ' +
            'navigate to legacy applications to send that information in a way that the legacy application can ' +
            'capture it.',
        type: String,
        transform: (v) => v,
        validate: (v) => ['none', 'manual', 'always'].indexOf(v) !== -1,
        defaultValue: 'always',
        env: 'WABS_BROWNIE',
        group: 'brownie'
    },
    brownieUrl: {
        alias: 'u',
        description: 'The URL to use as a web service to encode and decode brownie data.',
        type: String,
        defaultValue: 'https://lambda.byu.edu/ae/prod/brownie-dumper/cgi/brownie-dumper.cgi/json',
        env: 'WABS_BROWNIE_URL',
        group: 'brownie'
    }
};

const ServerOptions = {
    development: {
        alias: 'd',
        description: 'Set the server into development mode, removing optimizations while improving the ability to debug.',
        type: Boolean,
        env: 'WABS_DEVELOPMENT',
        group: 'server'
    },
    endpoint: {
        alias: 'e',
        description: 'The endpoint for the web application bootstrap server\'s services. This endpoint will take ' +
            'priority over proxied source endpoints.',
        type: String,
        defaultValue: '/wabs',
        env: 'WABS_ENDPOINT',
        group: 'server'
    },
    port: {
        alias: 'p',
        description: 'The port number to start the server on.',
        type: Number,
        defaultValue: 9000,
        env: 'WABS_PORT',
        group: 'server'
    },
    src: {
        alias: 's',
        description: 'Specify one or more web servers to proxy files from, including a unique URL endpoint that will proxy ' +
            'to the specified server. If the endpoint is not specified / will be used. The endpoint can be specified by ' +
            'adding a colon (:) after the web server followed by the endpoint path.\n\n' +
        chalk.bold('Example:') + '--src http://someserver.com --src http://server.org:/foo',
        type: String,
        required: true,
        multiple: true,
        env: 'WABS_SRC',
        group: 'server'
    }
};

Command.settings.envFileOption = true;

Command.defaultCommand = 'proxy';

Command.define('proxy', Server, {
    brief: 'Start a static file server or a proxy server that optionally integrates authorization and/or brownies ' +
        'into a client web application.',
    synopsis: ['[OPTIONS]...'],
    groups: {
        server: 'Server Options',
        auth: {
            title: 'Authentication / Authorization Options',
            description: 'If you are interested in having this server facilitate authentication and authorization ' +
                '(via OAuth) then you must set the ' + chalk.bold.cyan('--consumer-key --consumer-secret') + ' and ' +
                chalk.bold.cyan('--encrypt-secret') + ' options.'
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
        },
        cache: 'Cache Options'
    },
    options: Object.assign({}, ServerOptions, AuthenticateOptions, BrownieOptions),
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

Command.define('version', () => {
    const data = require(__dirname + '/../package.json');
    console.log(data.version);
}, { brief: 'Get the active version of WABS.' });