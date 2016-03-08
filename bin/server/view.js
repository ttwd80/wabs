"use strict";
const fs            = require('fs');
const httpStatus    = require('http-status-codes');
const noop          = require('./noop');
const path          = require('path');

module.exports = function(config) {
    return !config.proxy ? statusViewHandler(config) : noop;
};

function statusViewHandler(config) {
    var template;
    var templatePath;

    // get the template path
    templatePath = !config.statusView ?
        path.resolve(__dirname, '../www/view.html') :
        path.resolve(process.cwd(), config.statusView);

    // get the template content
    template = fs.readFileSync(templatePath, 'utf8');

    return function(req, res, next) {

        // define the res.sendStatusView function
        res.sendStatusView = function(status, title, body) {
            var result;

            if (!title) title = httpStatus.getStatusText(status);
            if (!body) body = '';

            result = template
                .replace(/\{\{status\}\}/g, status)
                .replace(/\{\{title\}\}/g, title)
                .replace(/\{\{body\}\}/g, body)
                .replace(/\{\{id\}\}/g, req.id);

            res.status(status).send(result);
        };

        next();
    };
}