"use strict";

exports.to = function(sep, text) {
    var index = 0;
    var match;
    var result = '';
    var rx = /[A-Z]/g;
    var subStr;

    while (match = rx.exec(str)) {
        subStr = str.substring(index, match.index).toLowerCase();
        if (subStr) result += subStr + sep;
        index = match.index;
        console.log(match);
    }

    return result + str.substr(index).toLowerCase();
};