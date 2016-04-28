"use strict";
const brownie           = require('../../bin/server/brownie');
const expect            = require('chai').expect;
const helper            = require('../../test-resources/test-helper');
const init              = require('../../bin/server/init');
const noop              = require('../../bin/server/noop');
const Request           = require('../../bin/request');

describe('server/brownie', function() {
    const init = {};

    let middleware;

    before(function() {
        return helper(init,
            {
                brownie: 'always',
                brownieUrl: ':mock-brownie',
                endpoint: '/wabs'
            })
            .then(function () {
                middleware = brownie(init.config)
            });
    });

    describe('can be configured to "none", "manual", or "always"', function() {
        ['none', 'manual', 'always'].forEach(function(mode) {
            it('mode: ' + mode, function() {
                var fn = brownie(Object.assign({}, init.config, { brownie: mode, brownieUrl: '' }));
                expect(helper.isMiddlewareFunction(fn)).to.equal(true)
            });
        })
    });

    it('"none" returns noop middleware', function() {
        var fn = brownie(Object.assign({}, init.config, { brownie: 'none', brownieUrl: '' }));
        expect(fn).to.be.equal(noop);
    });

    describe('POST', function() {
        let chain;
        let req;

        beforeEach(function() {
            chain = init.chain([
                init.middleware,
                middleware
            ]);

            Request.mock.on(opts => ~opts.url.indexOf(':mock-brownie'), function(options) {
                const json = JSON.stringify({
                    'Brownie-dumperService': {
                        request: { status: 200 },
                        response: {
                            properties: [
                                {
                                    name: "__brownie",
                                    group: "0000",
                                    type: "TEXT",
                                    size: "213",
                                    value: "266ab5365a6"
                                }
                            ]
                        }
                    }
                });
                return {
                    body: json
                };
            });

            req = init.req({
                method: 'POST',
                url: '/',
                headers: { 'transfer-encoding': 'application/json' },
                body: { brownie: '' },
                cookies: { brownie: '' }
            });
        });

        afterEach(function() {
            Request.mock.reset();
        });

        it('method transforms to GET', function(done) {
            chain(req, {}, function(err) {
                expect(req.method).to.equal('GET');
                done();
            });
            
        });

        it('wabs has decoded brownie', function(done) {
            chain(req, {}, function(err) {
                expect(req.wabs.brownie).to.have.property('__brownie');
                done(err);
            });
        });

    });

    /*
    JSON body parser is hanging - not sure why but it may have to do with the fact that the
    request is not actually a stream.

    describe('PUT', function() {
        let chain;
        let req;

        // set up a brownie server and a static server
        beforeEach(function() {
            chain = init.chain([
                init.middleware,
                middleware
            ]);

            Request.mock.on(opts => ~opts.url.indexOf(':mock-brownie'), function(options) {
                const json = JSON.stringify({
                    'Brownie-dumperService': {
                        request: { status: 200 },
                        response: {
                            properties: [
                                {
                                    name: "__brownie",
                                    group: "0000",
                                    type: "TEXT",
                                    size: "213",
                                    value: "266ab5365a6"
                                }
                            ]
                        }
                    }
                });
                return {
                    body: json
                };
            });

            req = init.req({
                method: 'PUT',
                url: '/wabs/brownie/encode',
                headers: {  },
                body: { __brownie: '' },
                cookies: { brownie: '' }
            });
        });

        afterEach(function() {
            Request.mock.reset();
        });

        it.only('wabs has encoded brownie', function(done) {
            const res = init.res();
            res.set = function() {};
            res.send = function(data) {
                done();
            };
            chain(req, res, function(err) {
                done(err);
            });
        });

    });*/

});