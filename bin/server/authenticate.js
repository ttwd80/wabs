"use strict";
const chalk             = require('chalk');
const crypto            = require('crypto');
const noop              = require('./noop');
const oauth             = require('byu-wabs-oauth');
const path              = require('path');

module.exports = Authenticate;

const authStage = {
    notAuthorized: 'Not Authorized',
    authenticated: 'Authenticated',
    authorized: 'Authorized'
};

function Authenticate(config, stats) {
    if (config.auth === 'none') return noop;

    const cKey = config.consumerKey;
    const cSecret = config.consumerSecret;
    const eSecret = config.hasOwnProperty('encryptSecret') ? config.encryptSecret : crypto.randomBytes(24).toString();
    const wkUrl = config.wellKnownUrl;

    function getRedirectUrl(req) {
        return  req.protocol + '://' + req.get('host') + config.endpoint + '/auth/';
    }

    return function(req, res, next) {

        // if not a GET then exit
        if (req.method !== 'GET') return next();

        /*res.clearCookie('wabs-auth-stage');
        res.clearCookie('wabs-auth');
        return next();*/

        // handle cas login response
        if (req.wabsEndpoint === 'auth/cas') {
            let auth = decodeWabAuthCookie(req, eSecret);

            // CAS verified login and refresh token exists
            if (req.query.ticket && req.query.redirect && auth && auth.refreshToken) {
                oauth.getAccessTokenFromRefreshToken(cKey, cSecret, wkUrl, auth.refreshToken, function (err, data) {
                    if (err) return next(err);

                    // unable to refresh so redirect to login
                    if (data.error) {
                        login(req, res, next, cKey, cSecret, wkUrl, getRedirectUrl(req) + 'oauth-code');

                    // store cookie and redirect
                    } else {
                        encodeWabAuthCookie(res, eSecret, data);
                        res.cookie('wabs-auth-stage', authStage.authorized);
                        res.redirect(req.query.redirect);
                    }
                });

            // CAS user not logged in or no refresh token exists
            } else {
                login(req, res, next, cKey, cSecret, wkUrl, getRedirectUrl(req) + 'oauth-code');
            }

        // handle oauth login request
        } else if (req.wabsEndpoint === 'auth/login') {
            login(req, res, next, cKey, cSecret, wkUrl, getRedirectUrl(req) + 'oauth-code');

        // handle oauth login code response
        } else if (req.wabsEndpoint === 'auth/oauth-code') {
            code(req, res, next, cKey, cSecret, wkUrl, getRedirectUrl(req) + 'oauth-code', eSecret);

        // handle the refresh token to get latest authorization code
        } else if (req.wabsEndpoint === 'auth/oauth-refresh' && req.query.code) {
            gateway(req, res, next, cKey, cSecret, wkUrl, getRedirectUrl(req) + 'oauth-code', eSecret);

        // verify authentication which app root load
        } else if (!req.wabsEndpoint && req.isAppRoot && stats.authMode(req.filePath) === 'always') {

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
                let url = encodeURIComponent(getRedirectUrl(req) + 'cas?redirect=' + req.url);
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
            chalk.bold.cyan('none') + ': Will not provide authentication support.\n\n' +
            chalk.bold.cyan('manual') + ': Will provide authentication support that must be manually triggered using ' +
            'the ' + chalk.underline('/wabs/login') + ' and ' + chalk.underline('/wabs/logout') + ' endpoints. (Note ' +
            'that those endpoints may be modified by the ' + chalk.italic('--endpoint') + ' option.\n\n' +
            chalk.bold.cyan('always') + ': Will force the user to be logged in to use any part of the application.',
        type: String,
        transform: (v) => v.toLowerCase(),
        validate: (v) => ['none', 'manual', 'always'].indexOf(v.toLowerCase()) !== -1,
        defaultValue: 'always',
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



function code(req, res, next, cKey, cSecret, wkUrl, redirectURI, eSecret) {

    // if a code wasn't provided then access was denied
    if (!req.query.code) {
        res.cookie('wabs-auth-stage', authStage.notAuthorized);
        res.redirect(decodeURIComponent(req.query.state));
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
                res.redirect(decodeURIComponent(req.query.state));
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

function login(req, res, next, key, secret, wkUrl, redirectURI) {
    const reqConfig = {
        redirect_uri: redirectURI,
        scope: 'openid',
        state: encodeURIComponent(req.query.redirect || '/')
    };
    oauth.generateAuthorizationCodeRequestURL(key, secret, wkUrl, reqConfig, function (err, url) {
        if (err) return next(err);
        res.redirect(url);
    });
}