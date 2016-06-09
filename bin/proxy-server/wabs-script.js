"use strict";
const fs                = require('fs');
const path              = require('path');
const uglify            = require('uglify-js');

module.exports = WabsScript;

function WabsScript(config) {
    var fullScripts;
    var rx = RegExp('^' + config.endpoint + '/wabs.js\\?(auth|brownie|full)');
    var scripts;

    // load minified scripts
    scripts = {
        auth: getScriptContent('auth.js', config.development),
        brownie: getScriptContent('brownie.js', config.development),
        init: getScriptContent('init.js', config.development)
    };

    // generate joined scripts
    fullScripts = {
        auth: wrapScripts(scripts.init + scripts.auth),
        brownie: wrapScripts(scripts.init + scripts.brownie),
        full: wrapScripts(scripts.init + scripts.auth + scripts.brownie)
    };

    return function injector(req, res, next) {
        var match;
        if (req.method !== 'GET') return next();

        // handle requests for WABS JavaScript files
        match = rx.exec(req.url);
        if (match) {
            res.send(fullScripts[match[1]]);
        } else {
            next();
        }

    }
}

function getScriptContent(filePath, development) {
    var absFilePath = path.resolve(__dirname, '../www/', filePath);
    return development ? fs.readFileSync(absFilePath, 'utf8') : uglify.minify(absFilePath).code;
}

function wrapScripts(script) {
    return '(function(){if(window.hasOwnProperty("byu"))return;\n' + script + '})()';
}