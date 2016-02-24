"use strict";

exports.serve = function(configuration) {

};

exports.options = [
    {
        name: 'client-id',
        alias: 'i',
        description: 'The client ID to use to obtain OAuth tokens.',
        type: String
    },
    {
        name: 'port',
        alias: 'p',
        description: 'The port number to start the server on.',
        type: Number,
        defaultValue: 9000
    },
    {
        name: 'src',
        alias: 's',
        description: 'The directory containing the static files to serve.',
        type: String
    }
];
