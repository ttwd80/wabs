#!/usr/bin/env node
"use strict";
const Command       = require('command-line-callback');
const server        = require('./bin/server');

if (require.main === module) {
    Command.evaluate();
} else {
    module.exports = server;
}