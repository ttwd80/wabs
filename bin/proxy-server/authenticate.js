"use strict";
const camel             = require('../camel');
const chalk             = require('chalk');
const crypto            = require('crypto');
const noop              = require('./noop');
const byuOauth          = require('byu-wabs-oauth');
const path              = require('path');
const services          = require('./services');

module.exports = Authenticate;

const authStage = {
    notAuthorized: 'Not Authorized',
    authenticated: 'Authenticated',
    authorized: 'Authorized'
};

function Authenticate(config) {

    // if no oauth configuration properties are set then send a no-op middleware function
    if (!config.hasOwnProperty('consumerKey') && !config.hasOwnProperty('consumerSecret') && !config.hasOwnProperty('encryptSecret')) return noop;

    // check that each required property is set
    ['consumerKey', 'consumerSecret', 'encryptSecret', 'wellKnownUrl'].forEach(function(key) {
        if (!config.hasOwnProperty(key)) throw Error('Missing required configuration setting: ' + camel.to('-', key));
    });

    const eSecret = config.encryptSecret;
    const oauth = byuOauth(config.consumerKey, config.consumerSecret, config.wellKnownUrl);

    function getRedirectUrl(req, endpoint) {
        const rx = /^(https?)?(?::\/\/)?([a-z0-9\.\-]+)?(:\d+)?$/i;
        const receivedHost = rx.exec(req.get('host'));
        var host;
        var match;
        var url;
        if (config.host && (match = rx.exec(config.host))) {
            host = (match[1] ? match[1] : req.protocol) + '://' +
                (match[2] ? match[2] : receivedHost[2]) +
                (match[3] ? match[3] : receivedHost[3] || '');
        } else {
            host = req.protocol + '://' + receivedHost[2] + (receivedHost[3] || '')
        }
        url = host + config.endpoint + '/auth/';
        if (endpoint) url += endpoint;
        return url;
    }

    // register the web services defined by this middleware
    services.register('auth.cas', config.endpoint + '/auth/cas', 'The URL to direct CAS to to verify the CAS token. A redirect query parameter is required.');
    services.register('oauth.login', config.endpoint + '/auth/oauth-login', 'The URL to use to log in to OAuth.');
    services.register('oauth.code', config.endpoint + '/auth/oauth-code', 'The URL to direct OAuth to that will receive the OAuth code.');
    services.register('oauth.refresh', config.endpoint + '/auth/oauth-refresh', 'The URL to call to attempt to refresh the OAuth token. This call requires that you include the query parameter: code (that has the value of the encoded refresh token).');
    services.register('oauth.revoke', config.endpoint + '/auth/oauth-revoke', 'The URL to call to revoke the OAuth token. This call requires that you include the query parameters: access (that has the value of the access token) and refresh (that has the value of the encoded refresh token).');

    return function authenticate(req, res, next) {

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
                refresh(req, res, next, oauth, auth.accessToken, auth.refreshToken, redirectUrl, eSecret);

                // CAS verified login but no refresh token
            } else if (req.query.ticket) {
                login(req, res, next, oauth, getRedirectUrl(req, 'oauth-code'));

                // CAS did not verify login
            } else {
                let url = encodeURIComponent(getRedirectUrl(req, 'cas?redirect=' + req.query.redirect));
                res.redirect('https://cas.byu.edu/cas/login?service=' + url);
            }

        // client oauth login request
        } else if (req.wabs.endpoint === 'auth/oauth-login') {
            login(req, res, next, oauth, getRedirectUrl(req, 'oauth-code'));

        // oauth response code redirects to here
        } else if (req.wabs.endpoint === 'auth/oauth-code') {
            code(req, res, next, oauth, getRedirectUrl(req, 'oauth-code'), eSecret);

        // handle the refresh token to get latest authorization code
        } else if (req.wabs.endpoint === 'auth/oauth-refresh' && req.query.access && req.query.code) {
            let refreshToken = decrypt(eSecret, req.query.code);
            gateway(req, res, next, oauth, req.query.access, refreshToken, eSecret);

        // handle a revoke command
        } else if (req.wabs.endpoint === 'auth/oauth-revoke') {
            if (!req.query.access && !req.query.refresh) {
                res.status(400).send('Unable to revoke oauth tokens. Missing required query parameters: access and refresh');
            } else if (!req.query.access) {
                res.status(400).send('Unable to revoke oauth tokens. Missing required query parameter: access');
            } else if (!req.query.refresh) {
                res.status(400).send('Unable to revoke oauth tokens. Missing required query parameter: refresh');
            } else {
                let refreshToken = decrypt(eSecret, req.query.refresh);
                oauth.revokeTokens(req.query.access, refreshToken)
                    .then(() => res.status(200).send('OK'))
                    .catch(next);
            }

        } else {
            next();
        }
    };
}

/**
 * Use an OAuth code to get the access tokens and other data.
 * @param {object} req The request object.
 * @param {object} res The response object.
 * @param {function} next The next middleware function.
 * @param {object} ouath The oauth instance object.
 * @param {string} redirectURI The redirect URL.
 * @param {string} eSecret The secret to encode the refresh token.
 */
function code(req, res, next, oauth, redirectURI, eSecret) {
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
        oauth.getCodeGrantAccessToken(req.query.code, redirectURI)
            .then(function(token) {
                var auth = {
                    accessToken: token.accessToken,
                    expiresIn: token.expiresIn,
                    openId: token.openId,
                    refreshToken: encrypt(eSecret, token.refreshToken),
                    status: ''
                };
                res.cookie('wabs-auth-stage', authStage.authorized);
                res.cookie('wabs-auth', JSON.stringify(auth));
                res.redirect(state.redirect);
            })
            .catch(function(err) {
                console.error(err.stack);
                next(err);
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
        accessToken: data.accessToken,
        expiresIn: data.expiresIn,
        openId: data.openId,
        refreshToken: encrypt(eSecret, data.refreshToken),
        scope: data.scope,
        tokenType: data.tokenType,
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
 * @param {function} next The next middleware function.
 * @param {object} oauth The oauth instance.
 * @param {string} accessToken The access token.
 * @param {string} refreshToken The decoded refresh token.
 * @param {string} eSecret The secret to encode the refresh token with.
 */
function gateway(req, res, next, oauth, accessToken, refreshToken, eSecret) {
    oauth.refreshTokens(accessToken, refreshToken)
        .then(function(token) {
            let authData = encodeWabAuthCookie(res, eSecret, token);
            res.json(authData);
        })
        .catch(next);
}

/**
 * Begin the OAuth login process.
 * @param {object} req The request object.
 * @param {object} res The response object.
 * @param {function} next The next middleware function.
 * @param {object} oauth The oauth instance.
 * @param {string} redirectURI The redirect URL.
 */
function login(req, res, next, oauth, redirectURI) {
    const state = { brownie: req.wabs.brownie, redirect: req.query.redirect || '/' };
    oauth.getCodeGrantAuthorizeUrl(redirectURI, 'openid', encodeURIComponent(JSON.stringify(state)))
        .then(function(url) {
            res.redirect(url);
        })
        .catch(next);
}

/**
 * Use the refresh token to get a new access token.
 * @param {object} req The request object.
 * @param {object} res The response object.
 * @param {function} next The next function.
 * @param {object} oauth The oauth instance.
 * @param {string} accessToken The access token to use.
 * @param {string} refreshToken The encrypted refresh token to use.
 * @param {string} redirectUrl The URL to direct back to after refresh.
 * @param {string} eSecret The secret to encode the refresh token.
 */
function refresh(req, res, next, oauth, accessToken, refreshToken, redirectUrl, eSecret) {
    oauth.refreshTokens(accessToken, refreshToken)
        .then(function(token) {
            res.cookie('wabs-auth-stage', authStage.authorized);
            res.redirect(req.query.redirect);
        })
        .catch(next);
}