"use strict";

var store = {};
var activeLoad = 0;
var terminal = false;

exports.add = function(obj) {
    var key = Symbol('');
    activeLoad++;
    store[key] = obj;
    return key;
};

exports.load = function() {
    return activeLoad;
};

exports.remove = function(key) {
    var result;
    if (store.hasOwnProperty(key)) {
        result = store[key];
        delete store[key];
        activeLoad--;
    }
    return result;
};