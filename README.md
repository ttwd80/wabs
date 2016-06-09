# byu-wabs

The official BYU **W**eb **A**pplication **B**ootstrap **S**erver.

This application runs a **proxy server** that adds functionality to client web applications to integrate authorization via OAuth and to provide interoperability with legacy code (via brownies).

## Quick Links

* [Installation](#installation)
* [Starting the Proxy Server](#starting-the-proxy-server)
* [Proxy Server Options](#server-options)
* [Configuration via Environment Variables](#configuration-via-environment-variables)
* [Authorization Options](#authorization-options)
* [Brownie Options](#brownie-options)
* [Client Application Authentication / Authorization Tools](#client-application-authentication--authorization-tools)
* [Client Application Brownie Tools](#client-application-brownie-tools)
* [Client Events](#client-events)
* [Web Services](#web-services)

## Installation

```sh
npm install -g byu-wabs
```

## Starting the Proxy Server

The server can be started from the command line and is configured through command line arguments. For a full listing of arguments and how they work, execute the following command from the command line:

```sh
byu-wabs --help
```

The help will inform you that you need to execute the command with options, in the following format:

```sh
byu-wabs [OPTIONS]...
```

Or a more specific example:

```sh
byu-wabs --port 9000 --consumer-key cOnsUmerKey --consumer-secret cOnsUmerSecrEt --encrypt-secret enCRytpSecreT --brownie always
```

For a list of options and what they do, please use `byu-wabs --help` from the command line.

## Configuration via Environment Variables

Some options can be configured via the setting of an environment variable. These environment variables can alo be passed
in via a file, using the --env-file flag.  For example, 'byu wabs --env-file development.env' will load all variables
defined in development.env.

Options specified in an --env-file will always override settings in the normal environment, and command-line arguments
will always override the env file.

## Proxy Server Options

### development

Set the server into development mode, removing optimizations while improving the ability to debug.

* **alias:** d
* **name:** development
* **type:** Boolean
* **default:** `false`
* **environment variable:** `WABS_DEVELOPMENT`

### endpoint

The endpoint for the [web application bootstrap server’s services](#web-services). Static files that fall within this path will not be served.

* **alias:** e
* **name:** endpoint
* **type:** String
* **default:** `/wabs`
* **environment variable:** `WABS_ENDPOINT`

**Examples**

```sh
byu-wabs -e /wabs-endpoint
```

```sh
byu-wabs --endpoint /wabs-endpoint
```

### port

The port number to start the server on.

* **alias:** p
* **name:** port
* **type:** Number
* **default:** `9000`
* **environment variable:** `WABS_PORT`

**Examples**

```sh
byu-wabs -p 80
```

```sh
byu-wabs --port 80
```

**Examples**

```sh
byu-wabs -p 80
```

```sh
byu-wabs --port 80
```

### src

Specify the URL to proxy requests for. Optionally you can also specify the route that will proxy to that URL by using a colon `:` followed by the route path.

* **alias:** s
* **name:** src
* **type:** String
* **multiple** true
* **environment variable:** `WABS_SRC`

**Example: Proxy with Default Endpoint**

```sh
byu-wabs -s http://someserver.com/
```

**Example: Local Path with Default Endpoint**

```sh
byu-wabs --src ./src-directory
```

**Example: Multiple Sources with Routes**

This example will cause any requests to `/beta` or a sub route (example: `/beta/foo/bar`) will proxy for `http://beta.com`. Any other routes that do not start with `/beta` will proxy for `http://alpha.com`.

```sh
--src http://alpha.com/:/ --src http://beta.com/:/beta
```

## Authorization Options

If you are interested in having this server facilitate authentication and authorization (via OAuth) then you must set the `--consumer-key` `--consumer-secret` and `--encrypt-secret` options. Enabling authorization will enable [Client Application Authorization Tools](#client-application-authentication--authorization-tools).

### consumer-key

The consumer key from the application defined in WSO2.

* **alias:** i
* **name:** consumerKey
* **type:** String
* **environment variable:** `WABS_CONSUMER_KEY`

### consumer-secret

The consumer secret from the application defined in WSO2.

* **alias:** t
* **name:** consumerSecret
* **type:** String
* **environment variable:** `WABS_CONSUMER_SECRET`

### encrypt-secret

The encryption secret to use to encrypt and decrypt the refresh token that is sent to the client.

* **alias:** n
* **name:** encryptSecret
* **type:** String
* **environment variable:** `WABS_ENCRYPT_SECRET`

### host

The full host name including protocol and port number that will be used to reach this server. If not specified then the server will automatically attempt to determine this information, but if the server is behind a proxy then it will be incorrect. Optionally, you may include a partial host and the server will attempt to fill the in the rest. Each of the following examples are valid: `https://somewhere.com:8000`, `https`, `https:8000`, `somewhere.com:8000`, `:8000`.

* **alias:** h
* **name:** host
* **type:** String
* **environment variable:** `WABS_HOST`

### well-known-url

The well known URL to use to get authentication information from.

* **alias:** k
* **name:** wellKnownUrl
* **type:** String
* **default:** `https://api.byu.edu/.well-known/openid-configuration`
* **environment variable:** `WABS_WELL_KNOWN_URL`

## Brownie Options

If you would like your client applications to have interoperability with legacy code (specifically the BYU-OIT C-framework) then you must set the brownie option to either `manual` or `always`.

If set to either `manual` or `always` then all other brownie options are required. Also, in these modes the client application will automatically have access to additional tools. For details on these tools see the section titled [Client Application Brownie Tools](#client-application-brownie-tools).

If set to `none` then all other brownie options are ignored and the client application will not have access to the [Client Application Brownie Tools](#client-application-brownie-tools).

### brownie

Specify the level of brownie support. Valid values include `none`, `manual`, `always`.

`none` - Will not provide brownie support. `manual` - Will provide brownie data and the library but will not automatically trigger brownie data transfer when navigating to a legacy application. `always` - Will provide full brownie support and will automatically cause links that navigate to legacy applications to send that information in a way that the legacy application can capture it.

* **alias:** b
* **name:** brownie
* **type:** String
* **default:** `always`
* **environment variable:** `WABS_BROWNIE`

**Examples**

```sh
byu-wabs -b none
```

```sh
byu-wabs --brownie always
```

### brownie-url

The URL to use as a web service to encode and decode brownie data.

* **alias:** u
* **name:** brownieUrl
* **type:** String
* **default:** `https://lambda.byu.edu/ae/prod/brownie-dumper/cgi/brownie-dumper.cgi/json`
* **environment variable:** `WABS_BROWNIE_URL`

**Examples**

```sh
byu-wabs -u http://somewhere.com/brownie-service
```

```sh
byu-wabs --brownie-url http://somewhere.com/brownie-service
```

## Client Application Authorization Tools

If the [authorization options](#authorization-options) are set then your client application will automatically get access to a few additional tools:

### HTML Meta Tags

You can add meta tags to your HTML document that will alter how the proxy server interacts with your file.

#### wabs-auth-refresh

Set the authorization auto refresh using ```<meta name="wabs-auth-refresh" content="true">```.

- If the content value is `0` or `false` then authorization auto refresh will be disabled.
- Any other value will enable auto-refresh.

The default value is `true`.

### JavaScript

Your client application will have access to two global objects:

#### byu.user

An `Object` with data about the authenticated user. This information is provided through OAuth when the user authenticates and authorizes the application. If the user is not authenticated or authorized the application then this object will have a value of `null`.

#### byu.auth

Will have the following properties and functions:

##### accessToken

[readonly] The OAuth access token.

**Example**

```js
var x = byu.auth.accessToken;
```

##### autoRefresh

Whether the access token gained through user authentication and application authorization should be refreshed automatically when it expires.

The default value is `true`.

**Example**

```js
byu.auth.autoRefresh = false;      // disable auto refresh
```

##### expired

[readonly] A boolean indicating whether the OAuth access token has expired.

```js
var expired = byu.auth.expired;
```

##### expires

[readonly] The number of milliseconds until the OAuth token expires. Note that this will only be accurate to 60000 milliseconds.login() - A function that takes no parameters and will log the user in.

```js
var expiresInMilliseconds = byu.auth.expires;
```

##### logout ( [casLogout  [,  redirect]  ] )

A function that will log the user out.

**Parameters**

- **casLogout** - An *optional boolean* that specifies whether to perform a CAS logout. Defaults to `true`.
- **redirect** - An *optional url* or *false* that is used to specify the URL of where to direct the client after logout. If not specified then the client will be redirected to the current page. If set to false then no redirect will occur.

**Returns** undefined

**Examples**

```js
byu.auth.logout();  // clear OAuth data, log out of CAS, and reload to page
```

```js
byu.auth.logout(false); // clear OAuth data, don't log out of CAS, and reload page
```

```js
byu.auth.logout(false, false); // clear OAuth data, don't log out of CAS, and don't reload the page
```

```js
byu.auth.logout(true, 'http://www.byu.edu');    // clear OAuth data, log out of CAS, and direct browser to a URL
```

##### refresh( [ callback ] )
A function that will refresh the OAuth access token.

**Parameters**

- **callback** - An *optional function* that will be called once the refresh completes. An `Error` object will be passed as the first parameter if the refresh fails, otherwise null will be passed as the parameter.

**Returns** undefined

**Example**

```js
byu.auth.refresh();
```

##### refreshToken

[readonly] The encrypted OAuth refresh token.

**Example**

```js
var x = byu.auth.refreshToken;
```

## Client Application Brownie Tools

If the brownie option is set to either `always` or `manual` then your client application will automatically get access to a few additional tools:

### HTML Meta Tags

#### wabs-brownie

Set the brownie mode within the page to either "manual" or "always" using `<meta name="wabs-brownie" content="manual">` or `<meta name="wabs-brownie" content="always">`

### JavaScript

Your client application will have access to the byu.brownie object. This object has the following functions:

#### byu.brownie

##### clear()

A function that will wipe out the active brownie data.

**Example**

```js
byu.brownie.clear();
```

##### get( [ key ] )

A function to get a brownie value with the key that is specified as the first parameter. If the key is omitted then you will get back a copy of the entire brownie data object.

**Parameters**

- **key** - An *optional string* that represents the key of the brownie data to get.

**Returns** A string, number, or the entire brownie object (if the *key* parameter is omitted).

**Example**

```js
byu.brownie.get();  // get an object with all key value pairs
```

```js
byu.brownie.get('user'); // get the brownie value associated with the "user" key
```

##### navigateTo( url, [, target ] )
A function to navigate to a URL and if that URL is a legacy app then send the legacy app the brownie data. This function will automatically be called if the brownie mode is set to "always" and a link is clicked that points to a legacy application.

**Parameters**

- **url** - A *required string* specifying where to navigate to.
- **target** - An *optional string* specifying the link target. For example, you might set it to `_blank`.

**Returns** undefined

**Example**

```js
byu.brownie.navigateTo('http://legacy.com/app', '_blank');
```

##### set( key,  value )

A function to set a brownie property to a value.

**Parameters**

- **key** - A *required string* for the brownie key to set.
- **value** - A *required string or integer* for the value to set.

**Example**

```js
byu.brownie.set('user', 'Bob');
```

##### unset( key )

A function to remove a brownie property value. The first parameter is the key.

**Parameters**

- **key** - A *required string* for the brownie key to remove.

**Example**

```js
byu.brownie.unset('user');
```

## Client Events

The following events are be dispatched on the client's document object. To subscribe to these events you can add an event listener to the document object as follows:

```js
document.addEventListener(eventName, callback)
```

For each event listed it can also be listened to from the wide wabs event. The detail property for the event will include a shortened version of the event's full name plus a data object that has the detail for that event. Event names are formatted as `byu-wabs-<shortName>`. For example the event `byu-wabs-auth-update` will have the short name of `auth-update`.

```js
document.addEventListener('byu-wabs', function(e) {
    console.log(e.detail.name);     // the shortened name of the specific event
    console.log(e.detail.data);     // the detail for that specific event
});
```

#### byu-wabs-ready

This event will be triggered when the wabs JavaScript has finished loading. It's detail property points to the global `byu` object.

**Example 1: Wide Event**

```js
document.addEventListener('byu-wabs', function(e) {
    if (e.detail.name === 'ready') {
        console.log('Ready to use BYU object');
    }
});
```

**Example 2: Specific Event**

```js
document.addEventListener('byu-wabs-ready', function(e) {
    console.log('Ready to use BYU object');
});
```

### Authentication / Authorization Events

These events are specific to the authentication / authorization mode and will only fire if the mode is set to either `manual` or `always`.

#### byu-wabs-auth-auto-refresh

This event fires whenever the `byu.auth.autoRefresh` value is modified. The detail property has the updated autoRefresh value.

```js
document.addEventListener('byu-wabs-auth-auto-refresh', function(e) {
    console.log('Auto refresh set to: ' + e.detail);
});
```

#### byu-wabs-auth-error

This event fires whenever the authentication / authorization was attempted but failed, including during a refresh. The event detail property will contain an Error object for the Error that occurred.

```js
document.addEventListener('byu-wabs-auth-error', function(e) {
    console.error(e.detail.stack);
});
```

#### byu-wabs-auth-logout

This event fires when the user has been logged out. This can occur for a variety of reasons, including if the access token attempted to refresh and was unable to do so. The detail will be an object with two properties: `casLogout` that is a boolean indicating whether cas logout occurred, and `redirect` that can be either `false` for no redirect or a string of the URL to which the redirect is pointng.

```js
document.addEventListener('byu-wabs-auth-logout', function(e) {
    console.log('Auto refresh set to: ' + e.detail);
});
```

#### byu-wabs-auth-update

This event fires when the user has successfully logged in and been authorized. The event detail is an object with the properties `accessToken` and `refreshToken`.

```js
document.addEventListener('byu-wabs-auth-update', function(e) {
    console.log('Access Token: ' + e.detail.accessToken);
    console.log('Encrypted Refresh Token: ' + e.detail.refreshToken);
});
```

### Brownie Events

These events are specific to the brownie mode and will only fire if the mode is set to either `manual` or `always`.

#### byu-wabs-brownie-delete

This event fires when a key on the brownie is removed. The detail object has the properties `key` and `value` that indicate what was removed from the brownie object.

```js
document.addEventListener('byu-wabs-brownie-delete', function(e) {
    console.log('Key: ' + e.detail.key);
    console.log('Value: ' + e.detail.value);
});
```

#### byu-wabs-brownie-navigate

This event fires whenever the `byu.brownie.navigateTo` function is called and includes in the detail object the properties `encodeNeeded` which specifies whether the server will need to reencode the brownie data, `legacyUrl` which tells whether the page being navigated to is a legacy web application, `target` the browser target window, and `url` the URL to navigate to.

```js
document.addEventListener('byu-wabs-brownie-navigate', function(e) {
    console.log('Encode needed: ' + e.detail.encodeNeeded);
    console.log('Legacy URL: ' + e.detail.legacyUrl);
    console.log('Target: ' + e.detail.target);
    console.log('URL: ' + e.detail.url);
});
```

#### byu-wabs-brownie-update

This event fires when a key on the brownie is set. The detail object has the properties `key` and `value` that indicate what was removed from the brownie object.

```js
document.addEventListener('byu-wabs-brownie-update', function(e) {
    console.log('Key: ' + e.detail.key);
    console.log('Value: ' + e.detail.value);
});
```

## Web Services

You probably only care about a single web service provided by the web application bootstrap server, namely the service that WSO2 must redirect the browser to with the OAuth code:

```
/wabs/auth/oauth-code
```

The URL may be different if you modified the [server endpoint option](#endpoint).

To see a list of all available services, load up your client application and look at the JavaScript object `byu.wabs.services`.
