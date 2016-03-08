"use strict";
const expect            = require('chai').expect;
const noop              = require('../../bin/server/noop');

describe('server/noop', function() {

    it('returns nothing', function() {
        var result = noop(null, null, function() {});
        expect(result).to.be.undefined;
    });

    it('ignores the first parameter', function() {
        expect(() => noop(void 0, null, function() {})).to.not.throw(Error);
    });

    it('ignores the second parameter', function() {
        expect(() => noop(null, void 0, function() {})).to.not.throw(Error);
    });

    it('must have a callback as the 3rd parameter', function() {
        expect(() => noop(null, null, null)).to.throw(Error);
    });

    it('calls the next callback', function(done) {
        noop(null, null, function() {
            done();
        });
    });

});