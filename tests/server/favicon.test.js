"use strict";
const favicon           = require('../../bin/server/favicon');
const expect            = require('chai').expect;
const fs                = require('fs');
const helper            = require('../../test-resources/test-helper');
const noop              = require('../../bin/server/noop');

describe('server/favicon', function() {

    it('uses noop middleware if proxy', function() {
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
    });

});