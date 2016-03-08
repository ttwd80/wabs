"use strict";
const error             = require('../../bin/server/error');
const expect            = require('chai').expect;

describe('server/error', function() {

    it('calls next if no error', function(done) {
        var res = {
            sendStatusView: function(code) {
                done(Error('Did not expect send'));
            }
        };

        error(null, {}, res, function(err) {
            done(err);
        });
    });

    it('calls sends status view if error', function(done) {
        var res = {
            sendStatusView: function(code) {
                expect(code).to.be.equal(500);
                done();
            }
        };

        error(Error('Foo'), { id: '_id' }, res, function(err) {
            done(Error('Did not expect next'));
        });
    });

});