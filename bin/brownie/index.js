#!/usr/bin/env node
"use strict";
const Command           = require('command-line-callback');
const crypt             = require('./crypt');

Command.define('decode', decode, {
    brief: 'Decode an encoded brownie.',
    options: {
        brownie: {
            alias: 'b',
            type: String,
            description: 'The encoded brownie.',
            required: true
        },
        key: {
            alias: 'k',
            type: String,
            description: 'The session key to use to decode the brownie with.',
            required: true
        }
    }
});

Command.define('encode', encode, {
    brief: 'Set new data for an encoded brownie and get back the new brownie.',
    options: {
        brownie: {
            alias: 'b',
            type: String,
            description: 'The encoded brownie.',
            required: true
        },
        key: {
            alias: 'k',
            type: String,
            description: 'The session key to use to decode the brownie with.',
            required: true
        },
        data: {
            alias: 'd',
            type: Object,
            description: 'The data to set for the new encoded brownie.',
            defaultValue: {}
        }
    }
});


function decode(config) {
    return crypt.decode(config.brownie, config.key)
        .then(function(result) {
            return JSON.stringify(result, null, 2);
        });
}

function encode(config) {
    return crypt.encode(config.brownie, config.key, config.data)
        .then(function(result) {
            return JSON.stringify(result, null, 2);
        });
}