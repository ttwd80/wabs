(function() {
    var byu = {};
    document.domain = 'byu.edu';
    Object.defineProperty(window, 'byu', {
        configurable: false,
        enumerable: true,
        value: byu,
        writable: false
    });

    window.byu.wabs = JSON.parse(decodeURIComponent(document.querySelector('head meta[name="wabs-data"]').getAttribute('content')));
})();