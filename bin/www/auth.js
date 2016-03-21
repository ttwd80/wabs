(function() {
    "use strict";
    var accessToken;
    var auth = {};
    var autoRefresh = 0;
    var autoRefreshTimeoutId;
    var cookieName = 'wabs-auth';
    var dispatch = byu.__dispatch;
    var expires;
    var initTime;
    var logoutIframe;
    var refreshToken;

    Object.defineProperty(auth, 'accessToken', {
        enumerable: true,
        configurable: false,
        get: function() { return accessToken; },
        set: function(v) { throw Error('accessToken is read only'); }
    });

    /**
     * Set the auto refresh time. If a positive number then refresh will be used every number of minutes specified. For
     * example, 5 will refresh every 5 minutes. If using a negative number then this number indicates the number of
     * minutes before expiration. For example -5 will run the refresh 5 minutes before the access token expires. Setting
     * this value to zero or a non-number will disable auto refresh.
     */
    Object.defineProperty(auth, 'autoRefresh', {
        enumerable: true,
        configurable: false,
        get: function() {
            return autoRefresh;
        },
        set: function(value) {
            if (typeof value !== 'number' || isNaN(value)) value = 0;
            if (autoRefresh !== value) {
                autoRefresh = value;
                setAutoRefreshTimeout();
                dispatch('auth-auto-refresh', autoRefresh);
            }
        }
    });

    Object.defineProperty(auth, 'expired', {
        enumerable: true,
        configurable: false,
        get: function() { return !expires || Date.now() >= expires; },
        set: function() { throw Error('expires is read only'); }
    });

    Object.defineProperty(auth, 'expires', {
        enumerable: true,
        configurable: false,
        get: function() { return expires ? expires - (Date.now() - initTime) : void 0; },
        set: function() { throw Error('expires is read only'); }
    });

    Object.defineProperty(auth, 'refreshToken', {
        enumerable: true,
        configurable: false,
        get: function() { return refreshToken; },
        set: function() { throw Error('refreshToken is read only'); }
    });

    /**
     * Perform a login of CAS and OAuth.
     */
    auth.login = function() {
        var location = window.location.toString();
        window.location = byu.wabs.services['oauth.login'].url + '?redirect=' + encodeURIComponent(location);
    };

    /**
     * Perform a log out of OAuth and optionally CAS.
     * @params {boolean} [casLogout=true]
     * @params {boolean, string} [redirect=window.location.toString()]
     */
    auth.logout = function(casLogout, redirect) {

        // erase all auth data
        accessToken = void 0;
        expires = void 0;
        refreshToken = void 0;
        eraseCookie(cookieName);
        clearTimeout(autoRefreshTimeoutId);
        byu.user = void 0;

        // initialize optional arguments
        if (arguments.length < 1) casLogout = true;
        if (arguments.length < 2) redirect = window.location.toString();

        // dispatch the logout event
        dispatch('auth-logout', {
            casLogout: casLogout,
            redirect: redirect
        });

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
    };

    /**
     * Refresh the login.
     * @param {function} callback That gets an error as its first parameter if an error occurred.
     */
    auth.refresh = function(callback) {
        var err;
        if (arguments.length === 0) callback = function() {};
        if (auth.refreshToken) {
            ajaxGet(byu.wabs.services['oauth.refresh'].url + '?code=' + auth.refreshToken, function(status, text) {
                var data;
                var err;

                // process result
                if (status === 200) {

                    // attempt to parse the JSON string
                    try {
                        data = JSON.parse(text);
                    } catch (e) {
                        data = {
                            error: {
                                title: 'Unable to parse JSON response',
                                description: e.message
                            }
                        };
                    }

                    // handle the parsed result
                    if (!data.error) {
                        initialize(text, true);
                        callback(null);
                    } else  {
                        err = Error(data.error.title + ': ' + data.error.description);
                    }

                // not a 200 status code
                } else {
                    err = Error(text);
                }

                // report error
                if (err) {
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

    function ajaxGet(url, callback) {
        var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) callback(xhr.status, xhr.responseText);
        };
        xhr.open("GET", url);
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.send();
    }

    function createCookie(name,value,days) {
        var date;
        var expires;
        if (days) {
            date = new Date();
            date.setTime(date.getTime()+(days*24*60*60*1000));
            expires = "; expires="+date.toGMTString();
        } else {
            expires = "";
        }
        document.cookie = name+"="+value+expires+"; path=/";
    }

    function eraseCookie(name) {
        createCookie(name,"",-1);
    }

    function initialize(jsonString, storeCookie) {
        var data = jsonString ? JSON.parse(jsonString) : null;

        // update the init timestamp
        if (data && (!data.timestamp || storeCookie)) {
            storeCookie = true;
            data.timestamp = Date.now();
            jsonString = JSON.stringify(data);
        }

        // update access information
        accessToken = data ? data.accessToken : void 0;
        expires = data ? Date.now() + (data.expiresIn * 1000) : void 0;
        initTime = data ? data.timestamp : void 0;
        refreshToken = data ? data.refreshToken : void 0;

        // update the user
        window.byu.user = data ? data.openId : void 0;

        // reset timeout
        setAutoRefreshTimeout();

        // update the cookie
        if (data && storeCookie) createCookie(cookieName, encodeURIComponent(jsonString));

        // dispatch an event about the update
        dispatch('auth-update', {
            accessToken: accessToken,
            refreshToken: refreshToken
        });
    }

    function readCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i=0;i < ca.length;i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }

    // set the next auto refresh time
    function setAutoRefreshTimeout() {
        clearTimeout(autoRefreshTimeoutId);
        if (autoRefresh < 0) {
            autoRefreshTimeoutId = setTimeout(auth.refresh, expires - (autoRefresh * 1000));
        } else if (autoRefresh > 0) {
            autoRefreshTimeoutId = setTimeout(auth.refresh, autoRefresh * 1000);
        }
    }

    // initialize
    initialize(readCookie(cookieName) ? decodeURIComponent(readCookie(cookieName)) : null, false);

    // look for auth-auto-refresh metadata and set auto refresh
    (function() {
        var element = document.querySelector('meta[name="wabs-auth-refresh]');
        if (!element) {
            auth.autoRefresh = 0;
        } else {
            auth.autoRefresh = parseInt(element.getAttribute('content'));
        }
    })();

    // store the auth object
    window.byu.auth = auth;
})();