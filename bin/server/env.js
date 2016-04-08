"use strict";
const envFile = require('envfile');

module.exports = mapEnv;

function mapEnv(options, optConfig) {
    if (options.envFile) {
        var parsed = envFile.parseFileSync(options.envFile);
        _process(options, optConfig, parsed);
    }
    _process(options, optConfig, process.env);
}

function _process(options, optionConfig, env) {
    Object.getOwnPropertyNames(optionConfig).filter(function (name) {
        return optionConfig[name].hasOwnProperty('envVar')
            && env.hasOwnProperty(optionConfig[name].envVar);
    }).filter(function (name) {
        return !options.hasOwnProperty(name) || _isDefault(name, options[name], optionConfig[name])
    }).forEach(function (name) {
        options[name] = env[optionConfig[name].envVar]
    });
}

function _isDefault(name, value, cfg) {
    return cfg.hasOwnProperty('defaultValue')
        && cfg.defaultValue === value;
}

