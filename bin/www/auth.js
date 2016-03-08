(function() {
    "use strict";
    var accessToken;
    var auth = {};
    var autoRefresh = -5;
    var autoRefreshTimeoutId;
    var cookieName = 'wabs-auth';
    var expires;
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
            autoRefresh = value;
            setAutoRefreshTimeout();
        }
    });

    Object.defineProperty(auth, 'expired', {
        enumerable: true,
        configurable: false,
        get: function() { return !expires || Date.now() >= expires; },
        set: function(v) { throw Error('expires is read only'); }
    });

    Object.defineProperty(auth, 'expires', {
        enumerable: true,
        configurable: false,
        get: function() { return expires; },
        set: function(v) { throw Error('expires is read only'); }
    });

    Object.defineProperty(auth, 'refreshToken', {
        enumerable: true,
        configurable: false,
        get: function() { return accessToken; },
        set: function(v) { throw Error('refreshToken is read only'); }
    });

    /**
     * Perform a login.
     */
    auth.login = function() {
        var location = window.location.toString();
        window.location = byu.wabs.endpoint + '/auth/login?redirect=' + encodeURIComponent(location);
    };

    /**
     * Perform a log out.
     */
    auth.logout = function() {
        accessToken = void 0;
        expires = void 0;
        refreshToken = void 0;
        eraseCookie(cookieName);
        clearTimeout(autoRefreshTimeoutId);
    };

    /**
     * Refresh the login.
     * @param {function} callback That gets an error as its first parameter if an error occurred.
     */
    auth.refresh = function(callback) {
        if (refreshToken) {
            console.log('Refreshing access token');
            ajaxGet(byu.wabs.endpoint + '/auth/refresh?code=' + auth.refreshToken, function(status, text) {
                if (status === 200) {
                    initialize(text);
                    callback(null);
                } else {
                    callback(Error(text))
                }
            });
        } else {
            callback(Error('Refresh token does not exist.'));
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

        // update access information
        accessToken = data ? data.accessToken : void 0;
        expires = data ? Date.now() + (data.expiresIn * 1000) : void 0;
        refreshToken = data ? data.refreshToken : void 0;

        // update the user
        window.byu.user = data ? data.openId : void 0;

        // reset timeout
        setAutoRefreshTimeout();

        if (storeCookie) createCookie(cookieName, encodeURIComponent(jsonString));
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

    // store the auth object
    window.byu.auth = auth;
})();