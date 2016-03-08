"use strict";
/**
 * This file is used to encode and decode brownies, using the brownie-dumper web service to do handle the cryptography.
 * It should be noted that we've decided that the cryptography was never needed, so it doesn't matter that this
 * file is public or if the web service is public either.
 */
var request             = require('../request');

module.exports = function(serviceUrl) {
    var factory = {};

    /**
     * Decode a brownie from the C-framework.
     * @param {string} encodedBrownie
     * @param {string} sessionKey
     * @returns {Promise}
     */
    factory.decode = function(encodedBrownie, sessionKey) {
        var options = {
            url: serviceUrl + "?sessionKey=" + sessionKey + '&brownie=' + encodedBrownie,
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };
        return request(options).then(getDecodedBrownieFromResponse);
    };

    /**
     * Encode a brownie for the C-framework.
     * @param {string} encodedBrownie The original encoded brownie that the C-framework sent.
     * @param {string} sessionKey The session key.
     * @param {object} data The data to add to the brownie.
     * @returns {Promise}
     */
    factory.encode = function(encodedBrownie, sessionKey, data) {
        var body = Object.assign({ brownie: encodedBrownie, sessionKey: sessionKey }, data);
        var options = {
            url: serviceUrl,
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        };

        return request(options).then(getDecodedBrownieFromResponse);
    };

    return factory;
};

/**
 * Get a decoded brownie object from the web service's response.
 * @param {object} response
 * @returns {object}
 */
function getDecodedBrownieFromResponse(response) {
    var data = JSON.parse(response.body)['Brownie-dumperService'];
    var result = {};

    // validate the response structure
    if (!data.request || data.request.status !== 200 || !data.response) {
        throw Error('REST response has unexpected structure');
    }

    // iterate through the response properties to build the new decoded brownie object
    if (data.response.properties) {
        data.response.properties.forEach(function(property) {
            var value = property.value;

            //convert strings to the type specified
            if (typeof value === 'string') {
                switch (property.type) {
                    case 'DECIMAL':
                        value = parseFloat(value) || null;
                        break;
                    case 'INTEGER':
                        value = parseInt(value) || null;
                        break;
                }
            }

            //store the property on the result
            result[property.name] = value;
        });
    }

    // return the result
    return result;
}