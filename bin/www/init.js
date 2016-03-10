(function() {
    var byu = {};
    var match;
    var temp;

    // get the domain name (minus sub-domain) from the URL and use it to set the document domain
    match = /^https?:\/\/([a-zA-Z0-9\-\.]+?)[:\/]/.exec(window.location.toString());
    if (match) {
        temp = match[1].split('.');
        temp = temp.slice(temp.length - 2).join('.');
        if (/[a-z]/i.test(temp)) document.domain = temp;
    }

    // create a global byu object
    Object.defineProperty(window, 'byu', {
        configurable: false,
        enumerable: true,
        value: byu,
        writable: false
    });

    // store wabs data on the byu object
    window.byu.wabs = JSON.parse(decodeURIComponent(document.querySelector('head meta[name="wabs-data"]').getAttribute('content')));
})();