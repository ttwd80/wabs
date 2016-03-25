"use strict";

module.exports = function noop(req, res, next) {
    next();
};