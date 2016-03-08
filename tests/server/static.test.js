"use strict";
const expect            = require('chai').expect;
const fsStat            = require('../../bin/fs-stat');
const staticEp          = require('../../bin/server/static');

describe('server/injector', function() {

    it('has proxy and local middleware', function() {
        const local = staticEp({ proxy: false }, {});
        const proxy = staticEp({ proxy: true }, {});
        expect(local).to.not.be.equal(proxy);
    });

    describe('local', function() {
        var local;
        var stats;

        before(function() {
            return fsStat({ src: __dirname + '/../../test-resources/' })
                .then(function(factory) {
                    stats = factory;
                });
        });

        beforeEach(function() {
            local = staticEp({ proxy: false }, stats);
        });

        /*it('finds index.html from directory', function() {

        });*/


    });

    describe('proxy', function() {

    });

});