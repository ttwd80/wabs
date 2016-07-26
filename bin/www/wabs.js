(function(wabs) {
    "use strict";
    
    // don't allow this file to run twice
    if (window.hasOwnProperty("byu")) return;
    
    // store the time difference
    wabs.timeDiff = Date.now() - wabs.time;
    delete wabs.time;

    function ajax(url, method, data, callback) {
        var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) callback(xhr.status, xhr.responseText);
        };
        xhr.open(method, url);
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.send(data);
    }

    function authorizationSetup() {
        var auth = {};
        var authCookie;
        var autoRefresh;
        var autoRefreshTimeoutId;
        var expires;
        var logoutIframe;

        Object.defineProperty(byu, 'user', {
            enumerable: true,
            configurable: false,
            get: function() { return authCookie.openId; },
            set: function() { throw Error('user is read only'); }
        });

        Object.defineProperty(auth, 'accessToken', {
            enumerable: true,
            configurable: false,
            get: function() { return authCookie.accessToken; },
            set: function() { throw Error('accessToken is read only'); }
        });

        Object.defineProperty(auth, 'autoRefresh', {
            enumerable: true,
            configurable: false,
            get: function() {
                return autoRefresh;
            },
            set: function(value) {
                var bValue = !!value;
                if (autoRefresh !== bValue) {
                    autoRefresh = bValue;
                    setAutoRefreshTimeout();
                    dispatch('auth-auto-refresh', autoRefresh);
                }
            }
        });

        Object.defineProperty(auth, 'expired', {
            enumerable: true,
            configurable: false,
            get: function() { return !expires || Date.now() >= expires; },
            set: function() { throw Error('expired is read only'); }
        });

        Object.defineProperty(auth, 'expires', {
            enumerable: true,
            configurable: false,
            get: function() { return expires ? expires - Date.now() : void 0; },
            set: function() { throw Error('expires is read only'); }
        });

        Object.defineProperty(auth, 'refreshToken', {
            enumerable: true,
            configurable: false,
            get: function() { return authCookie.refreshToken; },
            set: function() { throw Error('refreshToken is read only'); }
        });

        /**
         * Perform a login of CAS and OAuth.
         */
        auth.login = function() {
            var location = window.location.toString();
            window.location = byu.wabs.services['oauth.authorize'].url + '?redirect=' + encodeURIComponent(location);
        };

        /**
         * Perform a log out of OAuth and optionally CAS.
         * @params {boolean} [casLogout=true]
         * @params {boolean, string} [redirect=window.location.toString()]
         */
        auth.logout = function(casLogout, redirect) {

            // initialize optional arguments
            if (arguments.length < 1) casLogout = true;
            if (arguments.length < 2 || redirect === true) redirect = window.location.toString();

            // revoke the tokens if they are set
            ajax(byu.wabs.services['oauth.revoke'].url, 'GET', '', function (status, text) {x

                if (status === 200) {

                    // if there is no redirect but we are doing CAS logout then use an iframe to log out
                    if (!redirect && casLogout) {
                        if (logoutIframe) logoutIframe.parentNode.removeChild(logoutIframe);
                        logoutIframe = document.createElement('iframe');
                        logoutIframe.style.display = 'none';
                        logoutIframe.style.position = 'absolute';
                        logoutIframe.style.zIndex = -1000;
                        logoutIframe.src = 'https://cas.byu.edu/cas/logout';
                        document.querySelector('body').appendChild(logoutIframe);

                        // perform a standard CAS logout with redirect
                    } else if (redirect && casLogout) {
                        window.location = 'https://cas.byu.edu/cas/logout?service=' + encodeURIComponent(redirect);

                    } else if (redirect) {
                        window.location = redirect;
                    }

                } else {
                    dispatch('auth-error', Error(text));
                }
            });

            // erase all auth data
            expires = void 0;
            clearTimeout(autoRefreshTimeoutId);
            eraseAuthData();

            // dispatch the logout event
            dispatch('auth-logout', {
                casLogout: !!casLogout,
                redirect: redirect
            });
        };

        /**
         * Refresh the login.
         * @param {function} callback That gets an error as its first parameter if an error occurred.
         */
        auth.refresh = function(callback) {
            var err;
            if (arguments.length === 0) callback = function() {};
            if (auth.accessToken && auth.refreshToken) {
                ajaxGet(byu.wabs.services['oauth.refresh'].url, function(status, text) {
                    if (status === 200) {
                        updateAuthData();
                        callback();
                    } else {
                        var err = Error(text);
                        err.status = status;
                        callback(err);
                        dispatch('auth-error', err);
                        auth.logout(false, false);
                    }
                });
            } else {
                err = Error('Refresh token does not exist.');
                callback(err);
                dispatch('auth-error', err);
                auth.logout(false, false);
            }
        };

        function eraseAuthData() {
            document.cookie = "wabs-auth=; expires=" + new Date(0, 0, 0, 0, 0, 0).toGMTString() + "; path=/";
            authCookie = null;
        }

        function updateAuthData() {
            authCookie = (function() {
                var cookie = /(?:^|;\s*)wabs-auth=([\s\S]*)?(?:\s*;|$)/.exec(document.cookie);
                if (!cookie) return null;

                var value = decodeURIComponent(cookie[1]);
                var match = /^s:([\s\S]+)?\.[a-zA-Z0-9\+]+$/.exec(value);
                if (!match) return null;

                try {
                    return JSON.parse(match[1]);
                } catch (e) {
                    return null;
                }
            })();

            // set expiration and refresh timeout
            expires = authCookie ? Date.now() + (authCookie.expiresIn * 1000) : void 0;
            setAutoRefreshTimeout();

            // dispatch an event about the update
            dispatch('auth-update', auth);
        }

        // set the next auto refresh time
        function setAutoRefreshTimeout() {
            clearTimeout(autoRefreshTimeoutId);
            if (auth.autoRefresh && typeof auth.expires !== 'undefined') {
                autoRefreshTimeoutId = setTimeout(auth.refresh, auth.expires + 1000);
            }
        }

        // initialize
        updateAuthData();
        auth.autoRefresh = !/^(?:false|0)$/i.test(getMetaContent('wabs-auth-refresh', 'true'));

        // store the auth object
        window.byu.auth = auth;
    }

    function brownieSetup() {
        var brownie = {};
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
            var detail = {
                encodeNeeded: encodeNeeded,
                legacyUrl: isCFrameworkRx.test(url),
                target: target,
                url: url
            };
            var form = document.createElement('form');
            form.setAttribute('target', target || '_self');
            form.setAttribute('method', 'POST');
            form.setAttribute('action', url);
            if (detail.legacyUrl) {
                if (encodeNeeded) {
                    dispatch('brownie-navigate', detail);
                    ajax(byu.wabs.services['brownie.encode'].url, 'PUT', store, function(status, data) {
                        if (status === 200) form.appendChild(createFormInput('brownie', data));
                        form.submit();
                    });
                } else {
                    dispatch('brownie-navigate', detail);
                    form.appendChild(createFormInput('brownie', store.__brownie));
                    form.submit();
                }
            } else {
                detail.encodeNeeded = false;
                dispatch('brownie-navigate', detail);
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
            var mode;
            var modeElement = document.querySelector('head meta[name="wabs-brownie"]');

            if (element) {
                data = getMetaContent('wabs-brownie-data');
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
    }

    // define the CustomEvent function if not already defined
    function defineCustomEvent() {
        if ( typeof window.CustomEvent === "function" ) return false;
        function CustomEvent ( event, params ) {
            params = params || { bubbles: false, cancelable: false, detail: undefined };
            var evt = document.createEvent( 'CustomEvent' );
            evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
            return evt;
        }
        CustomEvent.prototype = window.Event.prototype;
        window.CustomEvent = CustomEvent;
    }

    // define the dispatch event
    function dispatch(name, data) {
        document.dispatchEvent(new CustomEvent('byu-wabs-' + name, { detail: data }));
        document.dispatchEvent(new CustomEvent('byu-wabs', { detail: {
            name: name,
            data: data
        }}));
    }

    // get meta element's content
    function getMetaContent(name, defaultValue) {
        var el = document.querySelector('head meta[name="' + name + '"]');
        if (!el) return defaultValue;
        try {
            return JSON.parse(decodeURIComponent(el.getAttribute('content')));
        } catch (e) {
            return defaultValue;
        }
    }

    // get the domain name (minus sub-domain) from the URL and use it to set the document domain
    function setDocumentDomain() {
        var match;
        var temp;
        match = /^https?:\/\/([a-zA-Z0-9\-\.]+?)[:\/]/.exec(window.location.toString());
        if (match) {
            temp = match[1].split('.');
            temp = temp.slice(temp.length - 2).join('.');
            if (/[a-z]/i.test(temp)) document.domain = temp;
        }
    }

    //////////////////////////////////////////////////////////////

    // define the BYU object
    var byu = { wabs: wabs };
    Object.defineProperty(window, 'byu', {
        configurable: false,
        enumerable: true,
        value: byu,
        writable: false
    });

    setDocumentDomain();
    defineCustomEvent();
    if (useOAuth) authorizationSetup();
    if (useBrownie) brownieSetup();

    // fire ready event
    dispatch('ready', byu);
})