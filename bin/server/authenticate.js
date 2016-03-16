"use strict";
const camel             = require('../camel');
const chalk             = require('chalk');
const crypto            = require('crypto');
const noop              = require('./noop');
const oauth             = require('byu-wabs-oauth');
const path              = require('path');
const services          = require('./services');

module.exports = Authenticate;

const authStage = {
    notAuthorized: 'Not Authorized',
    authenticated: 'Authenticated',
    authorized: 'Authorized'
};

function Authenticate(config, stats) {
    console.log('Authenticate mode: ' + config.authenticate);

    if (config.authenticate === 'none') return noop;

    // check that each required property is set
    ['consumerKey', 'consumerSecret', 'encryptSecret', 'wellKnownUrl'].forEach(function(key) {
        if (!config.hasOwnProperty(key)) throw Error('Missing required configuration setting: ' + camel.to('-', key));
    });

    const cKey = config.consumerKey;
    const cSecret = config.consumerSecret;
    const eSecret = config.encryptSecret;
    const wkUrl = config.wellKnownUrl;

    function getRedirectUrl(req, endpoint) {
        var url = req.protocol + '://' + req.get('host') + config.endpoint + '/auth/';
        if (endpoint) url += endpoint;
        return url;
    }

    // register the web services defined by this middleware
    services.register('auth.cas', config.endpoint + '/auth/cas', 'The URL to direct CAS to to verify the CAS token. A redirect query parameter is required.');
    services.register('oauth.login', config.endpoint + '/auth/oauth-login', 'The URL to use to log in to OAuth.');
    services.register('oauth.code', config.endpoint + '/auth/oauth-code', 'The URL to direct OAuth to that will receive the OAuth code.');
    services.register('oauth.refresh', config.endpoint + '/auth/oauth-refresh', 'The URL to call to attempt to refresh the OAuth token.');

    return function(req, res, next) {

        // if not a GET then exit
        if (req.method !== 'GET') return next();

        // cas gateway request redirects to here
        if (req.wabs.endpoint === 'auth/cas') {
            let auth = decodeWabAuthCookie(req, eSecret);

            // missing redirect in the query
            if (!req.query.redirect) {
                res.sendStatusView(400, null, 'Required query parameter "redirect" not provided.');

            // CAS verified login and refresh token exists
            } else if (req.query.ticket && auth && auth.refreshToken) {
                let redirectUrl = getRedirectUrl(req, 'oauth-code');
                refresh(req, res, next, cKey, cSecret, wkUrl, auth.refreshToken, redirectUrl, eSecret);

            // CAS verified login but no refresh token
            } else if (req.query.ticket) {
                login(req, res, next, cKey, cSecret, wkUrl, getRedirectUrl(req, 'oauth-code'));

            // CAS did not verify login
            } else {
                let url = encodeURIComponent(getRedirectUrl(req, 'cas?redirect=' + req.query.redirect));
                res.redirect('https://cas.byu.edu/cas/login?service=' + url);
            }

        // client oauth login request
        } else if (req.wabs.endpoint === 'auth/oauth-login') {
            login(req, res, next, cKey, cSecret, wkUrl, getRedirectUrl(req, 'oauth-code'));

        // oauth response code redirects to here
        } else if (req.wabs.endpoint === 'auth/oauth-code') {
            code(req, res, next, cKey, cSecret, wkUrl, getRedirectUrl(req, 'oauth-code'), eSecret);

        // handle the refresh token to get latest authorization code
        } else if (req.wabs.endpoint === 'auth/oauth-refresh' && req.query.code) {
            let refreshToken = decrypt(eSecret, req.query.code);
            gateway(req, res, cKey, cSecret, wkUrl, refreshToken, eSecret);

        // verify authentication with app root load
        } else if (!req.wabs.endpoint && req.wabs.inject && req.wabs.authMode === 'always') {

            // authorization was denied
            if (req.cookies['wabs-auth-stage'] === authStage.notAuthorized) {
                res.clearCookie('wabs-auth-stage');
                res.sendStatusView(401, 'Not Authorized');

            // authorized
            } else if (req.cookies['wabs-auth-stage'] === authStage.authorized) {
                res.clearCookie('wabs-auth-stage');
                next();

            // authentication and authorization needed
            } else {
                let url = encodeURIComponent(getRedirectUrl(req, 'cas?redirect=' + req.url));
                res.redirect('https://cas.byu.edu/cas/login?service=' + url + '&gateway=true');
            }

        } else {
            next();
        }
    };
}

Authenticate.options = {
    authenticate: {
        alias: 'a',
        description: 'Specify the level of authentication support. Valid values include "none", "manual", "always". \n\n' +
            chalk.bold.green('none') + ': Will not provide authentication support and all other authentication ' +
            'options will be ignored.\n\n' +
            chalk.bold.green('manual') + ': Will provide authentication support that must be manually triggered using ' +
            'the global javascript functions ' + chalk.italic('byu.auth.login') + ', ' + chalk.italic('byu.auth.logout') +
            ', and ' + chalk.italic('byu.auth.refresh') + '.\n\n' +
            chalk.bold.green('always') + ': Will force the user to be logged in to use any part of the application.',
        type: String,
        transform: (v) => v.toLowerCase(),
        validate: (v) => ['none', 'manual', 'always'].indexOf(v.toLowerCase()) !== -1,
        defaultValue: 'none',
        group: 'auth'
    },
    consumerKey: {
        alias: 'i',
        description: 'The consumer key from the application defined in WSO2. This value must be set if the ' +
            chalk.italic('--authenticate') + ' option is set to either "manual" or "always".',
        type: String,
        group: 'auth'
    },
    consumerSecret: {
        alias: 't',
        description: 'The consumer secret from the application defined in WSO2. This value must be set if the ' +
            chalk.italic('--authenticate') + ' option is set to either "manual" or "always".',
        type: String,
        group: 'auth'
    },
    encryptSecret: {
        alias: 'n',
        description: 'The encryption secret to use to encrypt and decrypt the refresh token that is sent to the client. ' +
            'If this value is not specified then the encrypt secret will be randomly generated. Note that if you have ' +
            'clustered this server that you\'ll want to specify the same secret for each.',
        type: String,
        group: 'auth'
    },
    wellKnownUrl: {
        alias: 'k',
        description: 'The well known URL to use to get authentication information from.',
        type: String,
        defaultValue: 'https://api.byu.edu/.well-known/openid-configuration',
        group: 'auth'
    }
};

function analyzeOauthError(data) {
    var description;
    var title;
    var url = '';

    switch(data.error) {
        case 'invalid_request':
            title = 'Invalid Request';
            description = 'The OAuth request is malformed.';
            break;
        case 'invalid_client':
            title = 'Invalid Client';
            description = 'OAuth client authentication failed.';
            break;
        case 'invalid_grant':
            title = 'Invalid OAuth Token';
            description = 'The OAuth token is invalid, expired, or revoked.';
            break;
        case 'unauthorized_client':
            title = 'Unauthorized Client';
            description = 'The client is not authorized to use the authorization grant type.';
            break;
        case 'unsupported_grant_type':
            title = 'Unsupported Grant Type';
            description = 'The server does not support this grant type.';
            break;
        case 'invalid_scope':
            title = 'Invalid Scope';
            description = 'The requested scope is invalid.';
            break;
        default:
            title = 'Unexpected Error';
            description = data.error;
    }

    if (data.error_description) description = data.error_description;
    if (data.error_uri) url = data.error_uri;

    return {
        title: title,
        description: description,
        url: url
    };
}

/**
 * Use an OAuth code to get the access tokens and other data.
 * @param {object} req The request object.
 * @param {object} res The response object.
 * @param {function} next The next middleware function.
 * @param {string} cKey The client key
 * @param {string} cSecret The client secret.
 * @param {string} wkUrl The well known URL.
 * @param {string} redirectURI The redirect URL.
 * @param {string} eSecret The secret to encode the refresh token.
 */
function code(req, res, next, cKey, cSecret, wkUrl, redirectURI, eSecret) {
    var state;

    // attempt to build the redirect URL
    if (req.query.state) {
        try {
            state = decodeURIComponent(req.query.state);
            state = JSON.parse(state);
        } catch (e) {
            console.error(e.stack);
        }
    }

    // malformed request
    if (!state) {
        res.sendStatusView(400);

    // if a code wasn't provided then access was denied
    } else if (!req.query.code) {
        res.cookie('wabs-auth-stage', authStage.notAuthorized);
        res.redirect(state.redirect);

    } else {
        oauth.getAccessTokenFromAuthorizationCode(cKey, cSecret, wkUrl, req.query.code, redirectURI, function(err, data) {
            if (err) {
                console.error(err.stack);
                next(err);
            } else {
                var auth = {
                    accessToken: data.access_token,
                    expiresIn: data.results.expires_in,
                    openId: data.open_id,
                    refreshToken: encrypt(eSecret, data.refresh_token),
                    status: ''
                };
                res.cookie('wabs-auth-stage', authStage.authorized);
                res.cookie('wabs-auth', JSON.stringify(auth));
                res.redirect(state.redirect);
            }
        });
    }
}

/**
 * Encrypt some text.
 * @param {string} secret The encryption key.
 * @param {string} text The text to encrypt.
 * @returns {string}
 */
function encrypt(secret, text){
    const cipher = crypto.createCipher('aes128', secret);
    var crypted = cipher.update(text,'utf8','hex');
    crypted += cipher.final('hex');
    return crypted;
}

/**
 * Decrypt some text.
 * @param {string} secret The decryption key.
 * @param {string} text The text to decrypt.
 * @returns {string}
 */
function decrypt(secret, text){
    var decipher = crypto.createDecipher('aes128', secret);
    var dec = decipher.update(text,'hex','utf8');
    dec += decipher.final('utf8');
    return dec;
}

/**
 * Encode the web auth cookie from an OAuth data object.
 * @param {object} res
 * @param {string} eSecret
 * @param {object} data
 * @returns {object} The encoded cookie object (before encoding)
 */
function encodeWabAuthCookie(res, eSecret, data) {
    var auth = {
        accessToken: data.access_token,
        expiresIn: data.results.expires_in,
        openId: data.open_id,
        refreshToken: encrypt(eSecret, data.refresh_token),
        status: ''
    };
    res.cookie('wabs-auth', JSON.stringify(auth));
    return auth;
}

/**
 * Decode the web auth cookie.
 * @param {object} req
 * @param {string} [eSecret] Set this value to also decrypt the refresh token.
 * @returns {object}
 */
function decodeWabAuthCookie(req, eSecret) {
    var data = req.cookies['wabs-auth'];
    if (data) {
        try {
            data = JSON.parse(data);
            if (eSecret) data.refreshToken = decrypt(eSecret, data.refreshToken);
            return data;
        } catch (e) {}
    }
    return null;
}

/**
 * Perform a refresh that will simply return whether the refresh worked or not.
 * @param {object} req The request object.
 * @param {object} res The response object.
 * @param {string} cKey The client key
 * @param {string} cSecret The client secret.
 * @param {string} wkUrl The well known URL.
 * @param {string} refreshToken The decoded refresh token.
 * @param {string} eSecret The secret to encode the refresh token with.
 */
function gateway(req, res, cKey, cSecret, wkUrl, refreshToken, eSecret) {
    oauth.getAccessTokenFromRefreshToken(cKey, cSecret, wkUrl, refreshToken, function (err, data) {
        if (err) return next(err);

        // if there is an error then send the error
        if (data.error) {
            let err = analyzeOauthError(data);
            res.json({ error: err });

        // send the data
        } else {
            let authData = encodeWabAuthCookie(res, eSecret, data);
            authData.error = null;
            res.json(authData);
        }
    });
}

/**
 * Get a query parameter off of a URL
 * @param url
 * @param name
 * @returns {string, undefined}
 */
function getQueryParameter(url, name) {
    var i;
    var params = (url.split('?')[1] || '').split('&');
    var pair;
    for (i = 0; i < params.length; i++) {
        pair = params[i].split('=');
        if (pair[0] === name) return pair[1];
    }
}

/**
 * Begin the OAuth login process.
 * @param {object} req The request object.
 * @param {object} res The response object.
 * @param {function} next The next middleware function.
 * @param {string} key The client key
 * @param {string} secret The client secret.
 * @param {string} wkUrl The well known URL.
 * @param {string} redirectURI The redirect URL.
 */
function login(req, res, next, key, secret, wkUrl, redirectURI) {
    const state = { brownie: req.wabs.brownie, redirect: req.query.redirect || '/' };
    const reqConfig = {
        redirect_uri: redirectURI,
        scope: 'openid',
        state: encodeURIComponent(JSON.stringify(state))
    };
    oauth.generateAuthorizationCodeRequestURL(key, secret, wkUrl, reqConfig, function (err, url) {
        if (err) return next(err);
        res.redirect(url);
    });
}

/**
 * Use the refresh token to get a new access token.
 * @param {object} req The request object.
 * @param {object} res The response object.
 * @param {function} next The next function.
 * @param {string} cKey The client key
 * @param {string} cSecret The client secret.
 * @param {string} wkUrl The well known URL.
 * @param {string} refreshToken The encrypted refresh token to use.
 * @param {string} redirectUrl The URL to direct back to after refresh.
 * @param {string} eSecret The secret to encode the refresh token.
 */
function refresh(req, res, next, cKey, cSecret, wkUrl, refreshToken, redirectUrl, eSecret) {
    oauth.getAccessTokenFromRefreshToken(cKey, cSecret, wkUrl, refreshToken, function (error, data) {
        if (error && error.data) error.data = JSON.parse(error.data);

        // refresh token expired so redirect to login
        if (error && error.data && error.data.error === 'invalid_grant') {
            login(req, res, next, cKey, cSecret, wkUrl, redirectUrl);

        // if another error then send a status view with details about the error
        } else if (error && error.data && error.data.error) {
            let err = analyzeOauthError(error);
            let body = err.description;
            if (err.url) body += '<br><a href="' + err.url + '" target="_blank">More Details...</a>';
            res.sendStatusView(500, err.title, body);

        // store auth stage cookie and redirect
        } else {
            res.cookie('wabs-auth-stage', authStage.authorized);
            res.redirect(req.query.redirect);
        }
    });
}