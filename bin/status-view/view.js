"use strict";
const fs            = require('fs');
const httpStatus    = require('http-status-codes');
const path          = require('path');

module.exports = function(templatePath) {
    var template;

    // get the template path
    templatePath = !templatePath ?
        path.resolve(__dirname, 'template.html') :
        path.resolve(process.cwd(), templatePath);

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
};