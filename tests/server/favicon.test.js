"use strict";
const favicon           = require('../../bin/server/favicon');
const expect            = require('chai').expect;
const helper            = require('../../test-resources/test-helper');
const path              = require('path');

describe('server/favicon', function() {
    const init = {};

    let middleware;
    let req;
    let res;

    before(() => helper(init));

    beforeEach(function() {
        middleware = favicon(init.stats);
        req = init.req({
            method: 'GET',
            wabs: { proxy: false },
            url: '/favicon.ico'
        });
        res = init.res();
    });

    it('is middleware', function() {
        expect(helper.isMiddlewareFunction(middleware)).to.equal(true);
    });

    it('skips favicon if not GET', function(done) {
        req.method = 'POST';
        res.sendFile = function() {
            done(Error('Should not send file'));
        };
        middleware(req, res, function(err) {
            done(err);
        });
    });

    it('skips favicon if not requesting favicon.ico', function(done) {
        req.url = '/foo.html';
        res.sendFile = function() {
            done(Error('Should not send file'));
        };
        middleware(req, res, function(err) {
            done(err);
        });
    });

    it('skips favicon in proxy mode', function(done) {
        req.wabs.proxy = true;
        res.sendFile = function() {
            done(Error('Should not send file'));
        };
        middleware(req, res, function(err) {
            done(err);
        });
    });

    it('gets favicon when it should', function(done) {
        res.sendFile = function() {
            done();
        };
        
        const fn = init.chain([
            init.middleware,
            middleware
        ]);

        fn(req, res, function(err) {
            if (err) return done(err);
            done(Error('Should have sent file'));
        });
    });

});