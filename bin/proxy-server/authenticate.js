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

    function getHost(req) {
        const rx = /^(https?)?(?::\/\/)?([a-z0-9\.\-]+)?(:\d+)?$/i;
        const receivedHost = rx.exec(req.get('host'));
        var host;
        var match;
        if (config.host && (match = rx.exec(config.host))) {
            return (match[1] ? match[1] : req.protocol) + '://' +
                (match[2] ? match[2] : receivedHost[2]) +
                (match[3] ? match[3] : receivedHost[3] || '');
        } else {
            return req.protocol + '://' + receivedHost[2] + (receivedHost[3] || '')
        }
    }

    function getRedirectUrl(req, endpoint) {
        var url;
        url = getHost(req) + config.endpoint + '/auth/';
        if (endpoint) url += endpoint;
        return url;
    }

    // register the web services defined by this middleware
    services.register('auth.cas', config.endpoint + '/auth/cas', 'The URL to direct CAS to to verify the CAS token. A redirect query parameter is required.');
    services.register('oauth.authorize', config.endpoint + '/auth/oauth-authorize', 'The URL to use to log in to OAuth.');
    services.register('oauth.code', config.endpoint + '/auth/oauth-code', 'The URL to direct OAuth to that will receive the OAuth code.');
    services.register('oauth.refresh', config.endpoint + '/auth/oauth-refresh', 'The URL to call to attempt to refresh the OAuth token. This call requires that you include the query parameter: code (that has the value of the encoded refresh token).');
    services.register('oauth.revoke', config.endpoint + '/auth/oauth-revoke', 'The URL to call to revoke the OAuth token. This call requires that you include the query parameters: access (that has the value of the access token) and refresh (that has the value of the encoded refresh token).');

    return function(req, res, next) {

        // if not a GET then exit
        if (req.method !== 'GET') return next();

        // get a decoded copy of the cookie
        const cookie = wabsAuthCookie(req, res, eSecret);
        const auth = cookie.get();

        // get the endpoint path if an auth path
        const match = /^auth\/(.*)$/.exec(req.wabs.endpoint);
        const endpoint = match ? match[1]: null;

        // response from CAS gateway query
        if (endpoint === 'cas-ticket') {
            let finalDestinationUrl = req.query.redirect ? req.query.redirect : getHost(req) + '/';

            // if no ticket then not authenticated with CAS
            if (!req.query.ticket) {
                res.redirect(finalDestinationUrl);

            // if there is a ticket then authorize with oAuth
            } else {
                let url = getRedirectUrl(req, 'oauth-authorize?redirect=' + encodeURIComponent(finalDestinationUrl));
                cookie.set(true, auth);
                res.redirect(url);
            }

        // make a request to authorize with oAuth
        } else if (endpoint === 'oauth-authorize') {
            let redirectUrl = getRedirectUrl(req, 'oauth-code');
            let state = { brownie: req.wabs.brownie };
            if (req.query.redirect) state.redirect = req.query.redirect;
            let stateEncoded = encodeURIComponent(JSON.stringify(state));

            oauth.getCodeGrantAuthorizeUrl(redirectUrl, 'openid', stateEncoded)
                .then(function(url) {
                    res.redirect(url);
                })
                .catch(next);

        // an oAuth code was received so verify the code now
        } else if (endpoint === 'oauth-code') {
            let state;

            // get state information
            if (req.query.state) {
                try {
                    state = decodeURIComponent(req.query.state);
                    state = JSON.parse(state);
                } catch (e) {
                    state = {};
                    console.error(e.stack);
                }
            }

            // set default brownie and redirect state information
            if (!state.brownie) state.brownie = null;
            if (!state.redirect) state.redirect = getHost(req) + '/';

            // if a code wasn't provided then access grant was denied
            if (!req.query.code) {
                cookie.set(auth.authenticated, null);
                res.redirect(state.redirect);
            } else {
                let oAuthRedirect = getRedirectUrl(req, 'oauth-code');
                oauth.getCodeGrantAccessToken(req.query.code, oAuthRedirect)
                    .then(function (token) {
                        cookie.set(true, token);
                        res.redirect(state.redirect);
                    })
                    .catch(function (err) {
                        console.error(err.stack);
                        next(err);
                    });
            }

        } else if (endpoint === 'oauth-refresh') {
            if (!auth.accessToken || !auth.refreshToken) {
                res.status(401).send('Unauthorized: oAuth tokens missing.')
            } else {
                oauth.refreshTokens(auth.accessToken, auth.refreshToken)
                    .then(function (token) {
                        cookie.set(!!token, token);
                        if (!token) {
                            res.status(401).send('Unauthorized: oAuth tokens invalid.');
                        } else {
                            res.status(200).send('OK: oAuth tokens successfully refreshed.');
                        }
                    })
                    .catch(next);
            }

        } else if (endpoint === 'oauth-revoke') {
            if (!auth.accessToken || !auth.refreshToken) {
                res.status(400).send('Bad request: nothing to revoke.');
            } else {
                oauth.revokeTokens(auth.accessToken, auth.refreshToken)
                    .then(() => res.status(200).send('OK: oAuth tokens revoked.'))
                    .catch(next);
            }

        // if there is no cookie then check CAS for login
        } else if (!cookie.exists()) {
            cookie.set(false, null);
            let url = encodeURIComponent(getRedirectUrl(req) + 'cas-ticket?redirect=' + getHost(req) + req.url);
            res.redirect('https://cas.byu.edu/cas/login?gateway=true&service=' + url);

        } else {
            next();
        }

    };

    return function authenticate(req, res, next) {

        // if not a GET then exit
        if (req.method !== 'GET') return next();

        // get a decoded copy of the cookie
        const cookie = wabsAuthCookie(req, res, eSecret);

        // cas gateway request redirects to here
        if (req.wabs.endpoint === 'auth/cas') {

            // missing redirect in the query
            if (!req.query.redirect) {
                res.sendStatusView(400, null, 'Required query parameter "redirect" not provided.');

            // CAS verified login and refresh token exists
            } else if (req.query.ticket && cookie.refreshToken) {
                let redirectUrl = getRedirectUrl(req, 'oauth-code');
                refresh(req, res, next, oauth, cookie.accessToken, cookie.refreshToken);

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
        res.clearCookie(cookieName);
        res.sendStatusView(400);

        // if a code wasn't provided then access was denied
    } else if (!req.query.code) {
        setWabsAuthCookie(res, eSecret, true, null);
        res.redirect(state.redirect);

    } else {
        oauth.getCodeGrantAccessToken(req.query.code, redirectURI)
            .then(function(token) {
                setWabsAuthCookie(res, eSecret, true, token);
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
 */
function refresh(req, res, next, oauth, accessToken, refreshToken) {
    oauth.refreshTokens(accessToken, refreshToken)
        .then(function(token) {
            res.redirect(req.query.redirect);
        })
        .catch(next);
}

/**
 * Get a wabs auth cookie manager.
 * @param {object} req
 * @param {object} res
 * @param {string} eSecret
 */
function wabsAuthCookie(req, res, eSecret) {
    const cookieName = 'wabs-auth';
    const factory = {};

    /**
     * Delete the cookie.
     */
    factory.clear = function() {
        res.clearCookie(cookieName);
    };

    /**
     * Determine if the cookie exists
     * @returns {boolean}
     */
    factory.exists = function() {
        return !!req.signedCookies[cookieName];
    };

    /**
     * Get a normalized wabs auth cookie.
     * @returns {object}
     */
    factory.get = function() {
        var data = req.signedCookies[cookieName];
        if (data) {
            try {
                data = JSON.parse(data);
                if (data.authorized) data.refreshToken = decrypt(eSecret, data.refreshToken);
                return data;
            } catch (e) {
                data = null;
            }
        }
        return data || {
            accessToken: '',
            authenticated: false,
            authorized: false,
            expiresIn: 0,
            openId: null,
            refreshToken: '',
            scope: '',
            tokenType: ''
        };
    };

    /**
     * Set a normalized wabs auth cookie.
     * @param {boolean} authenticated
     * @param {object} token
     */
    factory.set = function(authenticated, token) {
        const authorized = !!(authenticated && token);
        const data = {
            accessToken: authorized ? token.accessToken : '',
            authenticated: !!authenticated,
            authorized: authorized,
            expiresIn: authorized ? token.expiresIn : 0,
            openId: authorized ? token.openId : null,
            refreshToken: authorized ? encrypt(eSecret, token.refreshToken) : '',
            scope: authorized ? token.scope : '',
            tokenType: authorized ? token.tokenType : ''
        };
        const expires = new Date(Date.now() + (authorized ? token.expiresIn * 1000 : 60000));
        res.cookie(cookieName, JSON.stringify(data), { expires: expires, signed: true });
    };

    return factory;
}