"use strict";
const favicon           = require('../../bin/server/favicon');
const expect            = require('chai').expect;
const fs                = require('fs');
const helper            = require('../../test-resources/test-helper');
const MockRequest       = require('mock-express-request');
const MockResponse      = require('mock-express-response');
const noop              = require('../../bin/server/noop');
const path              = require('path');

describe.only('server/favicon', function() {
    const faviconPath = path.resolve(__dirname, '../../test-resources/favicon.ico');
    const statsStore = {};
    let middleware;
    let req;
    let res;

    before(function(done) {
        fs.stat(faviconPath, function(err, stats) {
            if (err) return done(err);
            statsStore[faviconPath] = stats;
            done();
        });
    });

    beforeEach(function() {
        middleware = favicon(statsStore);
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
        middleware(req, res, function(err) {
            if (err) return done(err);
            done(Error('Should have sent file'));
        });
    });



    /*it('uses noop middleware if proxy', function() {
        var fn = favicon({ proxy: true }, null);
        expect(fn).to.be.equal(noop);
    });

    it('uses express-favicon if not proxy', function(done) {
        var path = __dirname + '/../../test-resources/favicon.ico';
        fs.stat(path, function(err, stats) {
            var fn;
            var store = {};
            if (err) return done(err);
            store[path] = stats;
            fn = favicon({ proxy: false, src: __dirname + '/../../test-resources/favicon.ico' }, stats);
            expect(helper.isMiddlewareFunction(fn)).to.be.true;
            done();
        });
    });*/

});