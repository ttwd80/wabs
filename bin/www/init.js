(function () {
    if ( typeof window.CustomEvent === "function" ) return false;

    function CustomEvent ( event, params ) {
        params = params || { bubbles: false, cancelable: false, detail: undefined };
        var evt = document.createEvent( 'CustomEvent' );
        evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
        return evt;
    }

    CustomEvent.prototype = window.Event.prototype;

    window.CustomEvent = CustomEvent;
})();
(function() {
    var byu = {};
    var content;
    var element;
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

    // add a temporary dispatch function
    byu.__dispatch = dispatch;

    // store wabs data on the byu object
    element = document.querySelector('head meta[name="wabs-data"]');
    if (element) content = element.getAttribute('content');
    window.byu.wabs = content ? JSON.parse(decodeURIComponent(content)) : {};

    // fire ready event
    setTimeout(function() {
        dispatch('ready', byu);
        delete byu.__dispatch;
    }, 0);

    function dispatch(name, data) {
        document.dispatchEvent(new CustomEvent('byu-wabs-' + name, { detail: data }));
        document.dispatchEvent(new CustomEvent('byu-wabs', { detail: {
            name: name,
            data: data
        }}));
    }
})();