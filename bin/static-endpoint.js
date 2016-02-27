"use strict";
const crypt         = require('./brownie/brownie-crypt');
const brownie       = require('./brownie/brownie-endpoint');
const fs            = require('fs');
const path          = require('path');
const Promise       = require('bluebird');

const readFile = Promise.promisify(fs.readFile);

module.exports = function(srcDirectory, stats) {
    return function(req, res) {
        var filePath = path.resolve(srcDirectory, req.url.substr(1));
        var isAppRoot;

        // if the file path is a directory then try to get the index file path for that directory
        if (stats.isDirectory(filePath)) filePath = stats.getIndexFilePath(filePath);

        // determine if the file is an app root file
        isAppRoot = stats.isAppRoot(filePath);

        // if there is no file at the path then return a 404
        if (!stats.isFile(filePath)) {
            res.sendStatusView(404);

        // if the method is GET then send the file
        } else if (req.method === 'GET') {
            if (isAppRoot) {
                sendAppRoot(res, stats.get(filePath));
            } else {
                res.sendFile(filePath);
            }

        // if the method is POST then decode the brownie, then send the file
        } else if (req.method === 'POST' && isAppRoot) {
            let brownie;
            let sessionKey;

            // decode the brownie
            brownie = req.body.brownie;
            sessionKey = req.cookies.brownie;
            crypt.decode(brownie, sessionKey)
                .then(function(decodedBrownie) {
                    res.cookie('wabs-inject', JSON.stringify(decodedBrownie));
                    sendAppRoot(res, stats.get(filePath));
                })
                .catch(function(err) {
                    res.sendStatusView(500);
                    console.error(req.id + ' ' + err.stack);
                });

        // invalid method
        } else {
            res.sendStatusView(405);
        }
    };
};

function sendAppRoot(res, stats) {
    res.set('Accept-Range', 'bytes');
    res.set('Cache-Control', 'public, max-age=0');
    res.set('Content-Type', 'text/html');
    res.set('Last-Modified', stats.mtime);
    res.send(stats.html);
}