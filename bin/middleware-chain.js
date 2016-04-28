"use strict";

/**
 * Have an array of middleware functions act as a single middleware.
 * @param {function[]} middlewares
 * @returns {function}
 */
module.exports = function(middlewares) {
    return function(req, res, next) {
        const chain = middlewares.slice(0);

        function handle(req, res, next) {
            var active = chain.shift();
            if (!active) return next();
            active(req, res, function(err) {
                if (err) return next(err);
                handle(req, res, next);
            });
        }

        handle(req, res, next);
    };
};