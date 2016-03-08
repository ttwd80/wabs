"use strict";
const brownie           = require('../../bin/server/brownie');
const crypto            = require('../../bin/brownie/crypt');
const expect            = require('chai').expect;
const helper            = require('../../test-resources/test-helper');

describe('brownie/crypt', function() {
    var app;
    var crypt;

    // set up a brownie server
    beforeEach(function() {
        return helper.brownieServer()
            .then(function(value) {
                app = value;
                crypt = crypto('http://localhost:' + app.port);
            });
    });

    // shut down the brownie server
    afterEach(function() {
        app.close();
        app = void 0;
        crypt = void 0;
    });

    it('can decode', function() {
        return crypt.decode('foo', 'bar')
            .then(function(data) {
                expect(data).to.have.property('__brownie');
            });
    });

    it('can encode', function() {
        return crypt.encode('foo', 'bar', {})
            .then(function(data) {
                expect(data).to.have.property('__brownie');
            });
    });

});