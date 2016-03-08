"use strict";
const expect            = require('chai').expect;
const injector          = require('../../bin/server/injector');

describe('server/injector', function() {

    describe('#addInjectedSpaces', function() {

        it('no head or body', function() {
            var html = '<!doctype html><html></html>';
            expect(injector.addInjectSpaces(html)).to.be.equal(html);
        });

        it('head only', function() {
            var html = '<html><head></head></html>';
            expect(injector.addInjectSpaces(html)).to.be.equal('<html><head><!-- wabs-auth --><!-- wabs-brownie --></head></html>');
        });

        it('body only', function() {
            var html = '<html><body></body></html>';
            expect(injector.addInjectSpaces(html)).to.be.equal('<html><body><!-- wabs-script --></body></html>');
        });

        it('head and body', function() {
            var html = '<html><head></head><body></body></html>';
            var expected = '<html><head><!-- wabs-auth --><!-- wabs-brownie --></head><body><!-- wabs-script --></body></html>';
            expect(injector.addInjectSpaces(html)).to.be.equal(expected);
        });

    });

    describe('middleware', function() {

        it('does not add sendInjected if method is not GET', function(done) {
            var middleware = injector({ endpoint: '/foo' });
            var res = {};
            middleware({ method: '' }, res, function(err) {
                if (err) return done(err);
                expect(res.sendInjected).to.be.undefined;
                done();
            });
        });

        it('adds a sendInjected function to the res object', function(done) {
            var middleware = injector({ endpoint: '/foo' });
            var res = {};
            middleware({ method: 'GET' }, res, function(err) {
                if (err) return done(err);
                expect(res.sendInjected).to.be.a('function');
                done();
            });
        });

        it('handles endpoint request wabs.js?auth', function(done) {
            var middleware = injector({ endpoint: '/foo' });
            var res = {
                send: function(data) {
                    expect(data).to.be.a('string');
                    done();
                }
            };
            middleware({ method: 'GET', url: '/foo/wabs.js?auth' }, res, function() {
                done('Should not have hit next');
            });
        });

        it('handles endpoint request wabs.js?brownie', function(done) {
            var middleware = injector({ endpoint: '/foo' });
            var res = {
                send: function(data) {
                    expect(data).to.be.a('string');
                    done();
                }
            };
            middleware({ method: 'GET', url: '/foo/wabs.js?brownie' }, res, function() {
                done('Should not have hit next');
            });
        });


        it('handles endpoint request wabs.js?full', function(done) {
            var middleware = injector({ endpoint: '/foo' });
            var res = {
                send: function(data) {
                    expect(data).to.be.a('string');
                    done();
                }
            };
            middleware({ method: 'GET', url: '/foo/wabs.js?full' }, res, function() {
                done('Should not have hit next');
            });
        });




    });

});