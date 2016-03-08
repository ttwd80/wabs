(function(initData) {
    "use strict";
    var byu = {};



    byu.jwt = (function() {
        var user;

        return user;
    });

    byu.user = (function() {
        var user;

        return user;
    });

    //put the brownie factory into the window namespace
    Object.defineProperty(window, 'byu', {
        configurable: false,
        enumerable: true,
        value: byu,
        writable: false
    });

})();