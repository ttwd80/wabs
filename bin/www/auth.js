(function() {
    "use strict";
    var auth = {};
    var authCookie;
    var autoRefresh;
    var autoRefreshTimeoutId;
    var expires;
    var logoutIframe;
    var dispatch = byu.__dispatch;

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
        ajaxGet(byu.wabs.services['oauth.revoke'].url, 'GET', '', function (status, text) {x

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

    // look for auth-auto-refresh metadata and set auto refresh to true or false
    (function() {
        var element = document.querySelector('meta[name="wabs-auth-refresh"]');
        auth.autoRefresh = !element || !/^(?:false|0)$/i.test(element.getAttribute('content'));
    })();

    // store the auth object
    window.byu.auth = auth;
})();
