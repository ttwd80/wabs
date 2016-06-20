#!/usr/bin/env node
"use strict";
const Command       = require('command-line-callback');
const server        = require('./bin/proxy-server');

// define the command
require('./bin/cli');

if (require.main === module) {
    Command.evaluate();
} else {
    module.exports = function (config) {
        return Command.execute('proxy', config);
    };
}
