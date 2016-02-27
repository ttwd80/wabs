"use strict";
var commandLineArgs     = require('command-line-args');
var server              = require('./bin/server');
console.log('');

// if this file is the main file then evaluate the command line arguments and start the server
if (require.main === module) {
    let cli = commandLineArgs(server.options);
    let key;
    let camelKey;
    let options;

    try {
        options = cli.parse();
    } catch (e) {
        console.error(e.message);
        console.log(cli.getUsage());
        process.exit(0);
    }

    if (options.help) {
        console.log(cli.getUsage());
    } else {

        // camel case the options
        for (key in options) {
            if (options.hasOwnProperty(key) && /-/.test(key)) {
                camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                options[camelKey] = options[key];
                delete options[key];
            }
        }

        // start the server
        server.start(options);
    }

// if not the main file then return the server start function
} else {
    module.exports = server.start;
}