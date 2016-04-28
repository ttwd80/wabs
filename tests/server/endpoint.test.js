"use strict";
const endpoint      = require('../../bin/endpoint');
const expect        = require('chai').expect;

describe('endpoint', function() {

    describe('#map', function() {

        describe('proxy url source', function() {

            it('http, no port, no path', function() {
                var actual = endpoint.map({ src: ['http://something'] });
                expect(actual['/'].source).to.be.equal('http://something');
            });

            it('https, no port, no path', function() {
                var actual = endpoint.map({ src: ['https://something'] });
                expect(actual['/'].source).to.be.equal('https://something');
            });

            it('http, port, no path', function() {
                var actual = endpoint.map({ src: ['http://something:9000'] });
                expect(actual['/'].source).to.be.equal('http://something:9000');
            });

            it('https, port, no path', function() {
                var actual = endpoint.map({ src: ['https://something:9000'] });
                expect(actual['/'].source).to.be.equal('https://something:9000');
            });

            it('http, no port, path', function() {
                var actual = endpoint.map({ src: ['http://something/foo'] });
                expect(actual['/'].source).to.be.equal('http://something/foo');
            });

            it('https, no port, path', function() {
                var actual = endpoint.map({ src: ['https://something/foo'] });
                expect(actual['/'].source).to.be.equal('https://something/foo');
            });

            it('http, port, path', function() {
                var actual = endpoint.map({ src: ['http://something:9000/foo'] });
                expect(actual['/'].source).to.be.equal('http://something:9000/foo');
            });

            it('https, port, path', function() {
                var actual = endpoint.map({ src: ['https://something:9000/foo'] });
                expect(actual['/'].source).to.be.equal('https://something:9000/foo');
            });

        });

        describe('proxy url endpoint', function() {

            it('no endpoint', function() {
                var actual = endpoint.map({ src: ['http://something'] });
                expect(actual['/'].endpoint).to.be.equal('/');
            });

            it('/ endpoint', function() {
                var actual = endpoint.map({ src: ['http://something:/'] });
                expect(actual['/'].endpoint).to.be.equal('/');
            });

            it('foo endpoint', function() {
                var actual = endpoint.map({ src: ['http://something:foo'] });
                expect(actual['/foo'].endpoint).to.be.equal('/foo');
            });

            it('/foo endpoint', function() {
                var actual = endpoint.map({ src: ['http://something:/foo'] });
                expect(actual['/foo'].endpoint).to.be.equal('/foo');
            });

            it('/foo/ endpoint', function() {
                var actual = endpoint.map({ src: ['http://something:/foo/'] });
                expect(actual['/foo'].endpoint).to.be.equal('/foo');
            });

        });

        it('proxy url watch ignored', function() {
            var actual = endpoint.map({ src: ['http://something::true'], watch: true });
            expect(actual['/'].watch).to.be.equal(false);
        });

        it('local source, no endpoint, defaultWatch', function() {
            var actual = endpoint.map({ src: ['/foo'], watch: true });
            expect(actual['/'].source).to.be.equal('/foo');
            expect(actual['/'].watch).to.be.equal(true);
        });

        it('local source, endpoint, defaultWatch', function() {
            var actual = endpoint.map({ src: ['/foo:/bar'], watch: false });
            expect(actual['/bar'].source).to.be.equal('/foo');
            expect(actual['/bar'].watch).to.be.equal(false);
        });

        it('local source, no endpoint, watch', function() {
            var actual = endpoint.map({ src: ['/foo::true'], watch: false });
            expect(actual['/'].source).to.be.equal('/foo');
            expect(actual['/'].watch).to.be.equal(true);
        });

    });

});