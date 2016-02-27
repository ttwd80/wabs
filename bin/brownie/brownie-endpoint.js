"use strict";
/**
 * This file defines REST endpoint handler functions related to the brownie.
 */
const crypt         = require('./brownie-crypt');

exports.encode = function(req, res) {
    var brownie = req.body;
    var encodedBrownie;

    // if part of the brownie encoding data is missing then do a normal redirect
    if (!brownie || !brownie.__brownie || !req.cookies.brownie) return res.redirect(req.body.url);

    // get the encoded brownie data which will be used as the seed to encode the new brownie data
    encodedBrownie = brownie.__brownie.toString();
    delete brownie.__brownie;

    // encode the brownie
    crypt.encode(encodedBrownie, req.cookies.brownie, brownie)
        .then(function(value) {
            res.set('Content-Type', 'text/plain');
            res.send(value.__brownie);
        })
        .catch(function(reason) {
            res.sendStatusView(500, '', 'Brownie could not be encoded.');
            console.error(req.id + ' ' + reason.stack);
        });
};

