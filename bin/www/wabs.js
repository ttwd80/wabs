(function(initData) {
    "use strict";
    var byu = {};



    byu.jwt = null;

    byu.user = null;

    //put the brownie factory into the window namespace
    Object.defineProperty(window, 'byu', {
        configurable: false,
        enumerable: true,
        value: byu,
        writable: false
    });

})();