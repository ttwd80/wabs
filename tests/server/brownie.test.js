"use strict";
const brownie           = require('../../bin/server/brownie');
const expect            = require('chai').expect;
const helper            = require('../../test-resources/test-helper');
const noop              = require('../../bin/server/noop');

describe('server/brownie', function() {
    var config = {
        brownie: 'always',
        brownieUrl: '',
        endpoint: '/wabs'
    };

    describe('can be configured to "none", "manual", or "always"', function() {
        ['none', 'manual', 'always'].forEach(function(mode) {
            it('mode: ' + mode, function() {
                var fn = brownie(Object.assign({}, config, { brownie: mode, brownieUrl: '' }));
                expect(helper.isMiddlewareFunction(fn)).to.be.true;
            });
        })
    });

    it('"none" returns noop middleware', function() {
        var fn = brownie(Object.assign({}, config, { brownie: 'none', brownieUrl: '' }));
        expect(fn).to.be.equal(noop);
    });

    describe('POST', function() {
        var app;
        var middleware;
        var req;
        var res;

        // set up a brownie server and a static server
        beforeEach(function() {
            req = {
                method: 'POST',
                url: '/',
                headers: {
                    'transfer-encoding': 'application/json'
                },
                body: {
                    brownie: ''
                },
                cookies: {
                    brownie: ''
                }
            };
            res = { wabs: {} };

            return helper.brownieServer()
                .then(function(value) {
                    var url = 'http://localhost:' + value.port;
                    app = value;
                    middleware = brownie(Object.assign({}, config, { brownie: 'always', brownieUrl: url }));
                });
        });

        // shut down the brownie server
        afterEach(function() {
            app.close();
            middleware = null;
        });

        it('method transforms to GET', function(done) {
            middleware(req, res, function(err) {
                expect(req.method).to.equal('GET');
                done(err);
            });
        });

        it('wabs has decoded brownie', function(done) {
            middleware(req, res, function(err) {
                expect(res.wabs.brownie).to.have.property('__brownie');
                done(err);
            });
        });

    });

    describe('PUT', function() {
        var app;
        var middleware;
        var req;
        var res;

        // set up a brownie server and a static server
        beforeEach(function() {
            req = {
                method: 'PUT',
                url: '/wabs/brownie/encode',
                headers: {
                    'transfer-encoding': 'application/json'
                },
                body: {
                    __brownie: ''
                },
                cookies: {
                    brownie: ''
                }
            };
            res = { wabs: {} };

            return helper.brownieServer()
                .then(function(value) {
                    var url = 'http://localhost:' + value.port;
                    app = value;
                    middleware = brownie(Object.assign({}, config, { brownie: 'always', brownieUrl: url }));
                });
        });

        // shut down the brownie server
        afterEach(function() {
            app.close();
            middleware = null;
        });

        it('wabs has encoded brownie', function(done) {
            res.set = function() {};
            res.send = function(data) {
                done();
            };
            middleware(req, res, function(err) {
                done(err);
            });
        });

    });

});