"use strict";
const fs                = require('fs');
const path              = require('path');
const services          = require('./services');
const uglify            = require('uglify-js');

module.exports = WabsScript;

function WabsScript(config) {
    var content = getScriptContent('wabs.js', config.development);

    return function injector(req, res, next) {
        var match;
        var params;

        if (req.method !== 'GET') return next();

        // handle requests for WABS JavaScript files
        if (req.wabs.endpoint === 'wabs.js') {
            var wabsData = {
                endpoint: config.endpoint,
                auth: !!(config.consumerKey && config.consumerSecret && config.wellKnownUrl),
                brownie: config.brownie,
                services: services.get(),
                time: Date.now()
            };

            res.set('Content-type', 'text/javascript');
            res.send(content + '(' + JSON.stringify(wabsData) + ')');
        } else {
            next();
        }

    }
}

function getScriptContent(filePath, development) {
    var absFilePath = path.resolve(__dirname, '../www/', filePath);
    return development ? fs.readFileSync(absFilePath, 'utf8') : uglify.minify(absFilePath).code;
}