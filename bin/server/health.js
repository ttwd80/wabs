'use strict';
const services          = require('./services');

module.exports = function(config) {
    "use strict";

    // register the service
    services.register('health', config.endpoint + '/health', 'Get the health of the server');

    return function(req, res, next) {
        if (req.wabs.endpoint === 'health') {
            res.status(200).send('OK');
        } else {
            next();
        }
    }
};