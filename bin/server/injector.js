"use strict";
const cheerio           = require('cheerio');
const fs            = require('fs');
const path              = require('path');
const services          = require('./services');
const uglify            = require('uglify-js');

module.exports = injector;

function injector(config) {
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

        // add a sendInjected function to the response object
        res.sendInjected = function(content) {
            var data = {};
            var html = content;
            var script = getScriptReplacementString(config);

            // add additional data to the brownie
            data.brownie = {
                mode: config.brownie === 'always' ? 'auto' : 'manual',
                store: req.wabs.brownie
            };

            // modify the html
            html = replaceWithMeta(html, { endpoint: config.endpoint, auth: config.authenticate, brownie: config.brownie, services: services.get() }, 'wabs-data');
            html = replaceWithMeta(html, config.brownie !== 'none' ? data.brownie : '', 'wabs-brownie-data');
            html = html.replace('<!-- wabs-script -->', script);

            // send the html
            res.send(html);
        };

        // add sendInjectedFie function to the response object
        res.sendInjectedFile = function(filePath) {
            fs.readFile(filePath, 'utf8', function(err, content) {
                if (err) {
                    res.sendStatusView(404);
                } else {
                    const data = injectorProcessor(content);
                    res.sendInjected(data.html);
                }
            });
        };

        // handle requests for special JavaScript files
        match = rx.exec(req.url);
        if (match) {
            res.send(fullScripts[match[1]]);
        } else {
            next();
        }

    }
}

/**
 * Process the HTML, reading metadata and saving placeholders.
 * @param content
 * @returns {{authMode: *, html: *}}
 */
injector.process = injectorProcessor;

/**
 * Determine the script tag to return based on configuration.
 * @param config
 * @returns {string}
 */
function getScriptReplacementString(config) {
    var script;

    // figure out what JavaScript to load
    if (config.authenticate !== 'none' && config.brownie !== 'none') {
        script = 'full';
    } else if (config.authenticate !== 'none') {
        script = 'auth';
    } else if (config.brownie !== 'none') {
        script = 'brownie';
    }

    return script ?
        '<script src="' + config.endpoint + '/wabs.js?' + script + '"></script>' :
        '';
}

function getScriptContent(filePath, development) {
    var absFilePath = path.resolve(__dirname, '../www/', filePath);
    return development ? fs.readFileSync(absFilePath, 'utf8') : uglify.minify(absFilePath).code;
}

function injectorProcessor(content) {
    const $ctrl = cheerio.load(content);
    var authMode = null;
    var changed = false;

    // if the html has a head tag then add placeholders and look for metadata
    if ($ctrl('head').length > 0) {
        $ctrl('head').append('<!-- wabs-data --><!-- wabs-brownie-data -->');
        authMode = $ctrl('head meta[name="wabs-authenticate-mode"]').attr('content');
        changed = true;
    }

    // if the html has a body tag then add the script placeholder to the end of the body
    if ($ctrl('body').length > 0) {
        $ctrl('body').append('<!-- wabs-script -->');
        changed = true;
    }

    return {
        authMode: authMode,
        changed: changed,
        html: changed ? $ctrl.html() : content
    };
};

/**
 * Replace the associated placeholder with metadata and return the new string.
 * @param {string} content
 * @param {object} data
 * @param {string} name
 * @returns {string}
 */
function replaceWithMeta(content, data, name) {
    var sData = data && typeof data === 'object' ? encodeURIComponent(JSON.stringify(data)) : data;
    return content
        .replace('<!-- ' + name + ' -->', "<meta name='" + name + "' content='" + sData + "'>");
}

function wrapScripts(script) {
    return '(function(){if(window.hasOwnProperty("byu"))return;\n' + script + '})()';
}