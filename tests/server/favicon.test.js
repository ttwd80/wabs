"use strict";
const favicon           = require('../../bin/server/favicon');
const expect            = require('chai').expect;
const endpoint          = require('../../bin/endpoint');
const fsStat            = require('../../bin/fs-stat');
const helper            = require('../../test-resources/test-helper');
const init              = require('../../bin/server/init');
const MockRequest       = require('mock-express-request');
const MockResponse      = require('mock-express-response');
const mwChain           = require('../../bin/middleware-chain');
const path              = require('path');

describe('server/favicon', function() {
    const config = helper.configuration({
        src: [ path.resolve(__dirname, '../../bin/www') ],
        watch: true
    });
    const endpointMap = endpoint.map(config);

    let stats;
    let middleware;
    let req;
    let res;

    before(function() {
        return fsStat(config, endpointMap)
            .then(function(factory) {
                stats = factory;
            });
    });

    beforeEach(function() {
        middleware = favicon(stats);
        req = new MockRequest({
            method: 'GET',
            wabs: { proxy: false },
            url: '/favicon.ico'
        });
        res = new MockResponse({ req: req });
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
        
        const fn = mwChain([
            init(config, endpointMap, stats),
            middleware
        ]);

        fn(req, res, function(err) {
            if (err) return done(err);
            done(Error('Should have sent file'));
        });
    });

});