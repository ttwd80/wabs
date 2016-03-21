(function() {
    var brownie = {};
    var dispatch = byu.__dispatch;
    var encodeNeeded = false;
    var isCFrameworkRx = /^https?:\/\/y(?:-[a-z]*)?\.byu.edu\/(?:[\s\S]*?)\.cgi[\/\?]?/i;
    var store = {};

    /**
     * Clear the entire brownie.
     * @returns {object} for chaining.
     */
    brownie.clear = function() {
        Object.keys(store).forEach(function(key) {
            brownie.unset(key);
        });
        return brownie;
    };

    /**
     * Get a property's value from the brownie. If the key is omitted then the full brownie data object will be returned.
     * @param {string} [key]
     * @returns {number, string, null, undefined}
     */
    brownie.get = function(key) {
        var result;
        if (arguments.length > 0) {
            result = store.hasOwnProperty(key) ? store[key] : void 0;
        } else {
            result = {};
            Object.keys(store).forEach(function(key) {
                result[key] = store[key];
            });
        }
        return result;
    };

    /**
     * Navigate to a specified URL while maintaining brownie data.
     * @param {string} url The Url to navigate to.
     * @param {string} target The target window to cause to navigate.
     */
    brownie.navigateTo = function(url, target) {
        var form = document.createElement('form');
        form.setAttribute('target', target || '_self');
        form.setAttribute('method', 'POST');
        form.setAttribute('action', url);
        if (isCFrameworkRx.test(url)) {
            if (encodeNeeded) {
                dispatch('brownie-navigate', { modified: true, legacyUrl: true });
                ajaxPut(byu.wabs.services['brownie.encode'].url, store, function(status, data) {
                    if (status === 200) form.appendChild(createFormInput('brownie', data));
                    form.submit();
                });
            } else {
                dispatch('brownie-navigate', { modified: false, legacyUrl: true });
                form.appendChild(createFormInput('brownie', store.__brownie));
                form.submit();
            }
        } else {
            dispatch('brownie-navigate', { modified: false, legacyUrl: false });
            form.submit();
        }
    };

    /**
     * Set a property's value for the brownie.
     * @param {string} key
     * @param {number, string, null} value
     * @returns {object} for chaining.
     */
    brownie.set = function(key, value) {
        if (value === null || (typeof value === 'number' && !isNaN(value)) || typeof value === 'string') {
            if (store[key] !== value) {
                store[key] = value;
                encodeNeeded = true;
                storageUpdate();
                dispatch('brownie-update', {
                    key: key,
                    value: value
                });
            }
        } else {
            throw new Error('Invalid brownie property value. Value must be a string, a number, or null');
        }
        return brownie;
    };

    /**
     * Remove a property from the brownie.
     * @param {string} key
     * @returns {object} for chaining.
     */
    brownie.unset = function(key) {
        var value;
        if (store.hasOwnProperty(key)) {
            value = store[key];
            delete store[key];
            encodeNeeded = true;
            storageUpdate();
            dispatch('brownie-delete', {
                key: key,
                value: value
            });
        }
        return brownie;
    };


    function ajaxPut(url, data, callback) {
        var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) callback(xhr.status, xhr.responseText);
        };
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.send(JSON.stringify(data));
    }

    /**
     * Create an input element with the name value pair.
     * @param name
     * @param value
     * @returns {Element}
     */
    function createFormInput(name, value) {
        var input = document.createElement('input');
        input.setAttribute('name', name);
        input.setAttribute('value', value);
        return input;
    }

    /**
     * Intercept the click event and if it is a link click to a .cgi page then have the
     * brownie.navigateTo function handle the navigation.
     * @param e
     */
    function interceptClickEvent(e) {
        var href;
        var target = e.target || e.srcElement;
        if (target.tagName === 'A') {
            href = target.getAttribute('href');
            if (isCFrameworkRx.test(href)) {
                e.preventDefault();
                brownie.navigateTo(href, target.getAttribute('target'));
            }
        }
    }

    /**
     * Take what is in session storage and update brownie state.
     */
    function storageGet() {
        var data;
        if (window.sessionStorage) {
            data = sessionStorage.getItem('wabs-brownie');
            data = data ? JSON.parse(data) : { encodeNeded: false, store: {} };
            encodeNeeded = data.encodeNeeded;
            store = data.store;
        }
    }

    /**
     * Take what is in brownie state and update session storage.
     */
    function storageUpdate() {
        var data;
        if (window.sessionStorage) {
            data = {
                encodeNeeded: encodeNeeded,
                store: store
            };
            sessionStorage.setItem('wabs-brownie', JSON.stringify(data));
        }
    }

    // initialize
    (function() {
        var data;
        var element = document.querySelector('head meta[name="wabs-brownie-data"]');
        var mode;
        var modeElement = document.querySelector('head meta[name="wabs-brownie"]');

        if (element) {
            data = element.getAttribute('content');
            data = decodeURIComponent(data);
            data = JSON.parse(data);

            // determine the brownie mode
            mode = modeElement ? modeElement.getAttribute('content') : data.mode;

            // listen for link click events at the document level
            if (mode === 'auto') {
                if (document.addEventListener) {
                    document.addEventListener('click', interceptClickEvent);
                } else if (document.attachEvent) {
                    document.attachEvent('onclick', interceptClickEvent);
                }
            }

            // initialize the store
            if (data.store) {
                store = data.store;
                storageUpdate();
            } else {
                storageGet();
            }

        }
    })();

    // add the brownie object to the byu object
    window.byu.brownie = brownie;
})();