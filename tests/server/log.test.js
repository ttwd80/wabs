"use strict";
const expect            = require('chai').expect;
const helper            = require('../../test-resources/test-helper');
const log               = require('../../bin/server/log');

describe('server/log', function() {

    it('is a middleware function', function() {
        expect(helper.isMiddlewareFunction(log)).to.be.true;
    });

    it('adds an id property to the request object', function(done) {
        const req = {};
        log(req, {}, function(err) {
            if (err) return done(err);
            expect(req).to.have.property('id');
            done();
        });
    });

    it('modifies the write property to the request object', function(done) {
        const write = function() {};
        const res = { write: write };
        log({}, res, function(err) {
            if (err) return done(err);
            expect(res.write).to.not.be.equal(write);
            done();
        });
    });

});