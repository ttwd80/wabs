# byu-wabs

The official BYU **W**eb **A**uthentication **B**ootstrap **S**erver.

This application acts as either a **static file server** or a **proxy server** and adds functionality to client web applications to 1) integrate authentication, 2) facilitate OAuth, and 3) provide interoperability with legacy code (via brownies).

## Installation

It is recommended that this node package be installed globally:

```sh
npm install -g byu-wabs
```

## Starting the Server

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
byu-wabs --port 9000 --authenticate manual --consumer-key cOnsUmerKey --consumer-secret cOnsUmerSecrEt --encrypt-secret enCRytpSecreT --brownie always
```

For a list of options and what they do, please use `byu-wabs --help` from the command line.

## Server Options

### endpoint

The endpoint for the web application bootstrap server’s services. Static files that fall within this path will not be served.

* **alias:** e
* **type:** String
* **default:** `/wabs`

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
* **type:** Number
* **default:** `9000`

**Examples**

```sh
byu-wabs -p 80
```

```sh
byu-wabs --port 80
```

### src

Specify a source to serve files from. This can be either a file system path or the URL for another server to proxy requests for. You can also optionally specify the endpoint from which those resources should be available by specifying the path followed by ":" followed by the endpoint. If the endpoint is not specified then "/" is assumed. In short, the src should look like `[source]:[endpoint]:[watch]` where *source* is where to get the content, *endpoint* is the URL endpoint that will load from that source (defaulting to `/`), and *watch* will specify whether to watch that directory for changes (ignored when acting as a proxy).

* **alias:** s
* **type:** String
* **multiple** true
* **default:** `./:/`

**Example: Proxy with Default Endpoint**

```sh
byu-wabs -s http://someserver.com/
```

**Example: Local Path with Default Endpoint**

```sh
byu-wabs --src ./src-directory
```

**Example: Multiple Sources with Custom Endpoints**

This example will cause any requests to `/components` to be mapped to the current working directory plus `./bower-components` folder. For example: `http://localhost/components/file.js` could server the file from `/var/www/bower-components/file.js`.

This example will also direct any requests to `/proxy` to `http://someserver.com`. For example: `http://localhost/proxy/file.js` would get the file from `http://someserver.com/file.js`.

```sh
--src ./src:/ --src ./bower-components:/components --src http://someserver.com/:/proxy
```

### status-view

The file path to the html file that should be used as the status template. The status template will be used to show generic status pages. Text with `{{status}}`, `{{title}}`, `{{body}}`, and `{{id}}` will be replaced with the status code, title, body, and request ID respectively. If the server is acting as a proxy then status views will not display, instead the response from the proxied server will be sent.

* **alias:** v
* **type:** String

**Examples**

```sh
byu-wabs -v ./views/status.html
```

```sh
byu-wabs --status-view /var/www/views/status.html
```

### watch

If the src is pointing to a file system then this option is used to specify whether the file system should be watched for changes. It is recommended that for development this be set to true and for immutable production instances that it be set to false.

* **alias:** w
* **type:** Boolean
* **default:** `true`

**Examples**

```sh
byu-wabs -v ./views/status.html
```

```sh
byu-wabs --status-view /var/www/views/status.html
```

## Authentication / Authorization Options

If you are interested in having this server facilitate authentication and authorization (via OAuth) then you must set the authenticate option to either `manual` or `always`.

If set to either `manual` or `always` then all other authentication / authorization options are required (except where a default value exist for the option). Also in these modes the client application will automatically have access to additional tools. For details on these tools see the section titled [Client Application Authentication / Authorization Tools](#authentication--authorization-options).

If set to `none` then all other authentication options are ignored and the client application will not have access to the [Client Application Authentication / Authorization Tools](#authentication--authorization-options).

### authenticate

Specify the level of authentication support. Valid values include `none`, `manual`, `always`.

`none` - Will not provide authentication support and all other authentication options will be ignored. `manual` - Will provide authentication support that must be manually triggered using the global javascript functions byu.auth.login, byu.auth.logout, and byu.auth.refresh.
`always` - Will force the user to be logged in to use any part of the application.

* **alias:** a
* **type:** String
* **default:** `none`

**Examples**

```sh
byu-wabs -a none
```

```sh
byu-wabs --authenticate manual -i conSumerKEy -t ConsUmerSecreT -n eNcrYptioNsecrET
```

```sh
byu-wabs --authenticate always --consumer-key conSumerKEy --consumer-secret ConsUmerSecreT --encrypt-secret eNcrYptioNsecrET
```

### consumer-key

The consumer key from the application defined in WSO2. This value must be set if the --authenticate option is set to either `manual` or `always`.

* **alias:** i
* **type:** String

### consumer-secret

The consumer secret from the application defined in WSO2. This value must be set if the --authenticate option is set to either `manual` or `always`.

* **alias:** t
* **type:** String

### encrypt-secret

The encryption secret to use to encrypt and decrypt the refresh token that is sent to the client. If this value is not specified then the encrypt secret will be randomly generated. Note that if you have clustered this server that you’ll want to specify the same secret for each.

* **alias:** n
* **type:** String

### well-known-url

The well known URL to use to get authentication information from.

* **alias:** k
* **type:** String
* **default:** `https://api.byu.edu/.well-known/openid-configuration`

## Brownie Options

If you would like your client applications to have interoperability with legacy code (specifically the BYU-OIT C-framework) then you must set the brownie option to either `manual` or `always`.

If set to either `manual` or `always` then all other brownie options are required. Also, in these modes the client application will automatically have access to additional tools. For details on these tools see the section titled [Client Application Brownie Tools](#client-web-application-brownie-tools).

If set to `none` then all other brownie options are ignored and the client application will not have access to the [Client Application Brownie Tools](#client-web-application-brownie-tools).

### brownie

Specify the level of brownie support. Valid values include `none`, `manual`, `always`.

`none` - Will not provide brownie support. `manual` - Will provide brownie data and the library but will not automatically trigger brownie data transfer when navigating to a legacy application. `always` - Will provide full brownie support and will automatically cause links that navigate to legacy applications to send that information in a way that the legacy application can capture it.

* **alias:** b
* **type:** String
* **default:** `always`

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
* **type:** String
* **default:** `https://lambda.byu.edu/ae/prod/brownie-dumper/cgi/brownie-dumper.cgi/json`

**Examples**

```sh
byu-wabs -u http://somewhere.com/brownie-service
```

```sh
byu-wabs --brownie-url http://somewhere.com/brownie-service
```

## Client Web Application Authentication / Authorization Tools

If the authenticate option is set to either `manual` or `always` then your client application will automatically get access to a few additional tools:

### HTML Meta Tags

You can add meta tags to your HTML document that will alter how the server interacts with your file.

#### wabs-auth

Set the authenticate mode within the HTML page to either `manual` or `always` using ```<meta name=“wabs-auth” content=“manual”>``` or ```<meta name=“wabs-auth” content=“always”>```

#### wabs-auth-refresh

Set the authentication auto refresh using ```<meta name=“wabs-auth-refresh” content=“0”>``` where the content value is a number.

- If the number is zero `0` then authentication auto refresh will be disabled.
- If the number is positive `>0` then the auto refresh will occur number of minutes specified.
- If the number is negative `<0` then the refresh will occur that many number of minutes before the OAuth access token expires.

### JavaScript

Your client application will have access to two global objects:

#### byu.user

An `Object` with data about the authenticated user. This information is provided through OAuth when the user authenticates and authorizes. If the user is not authenticated and has authorized then this object will have a value of `undefined`.

#### byu.auth

Will have the following properties and functions:

##### accessToken

[readonly] The OAuth access token.

**Example**

```js
var x = byu.auth.accessToken;
```

##### autoRefresh

The authentication auto refresh interval.If the number is zero then authentication auto refresh will be disabled. If the number is positive then the auto refresh will occur number of minutes specified. If the number is negative then the refresh will occur that many number of minutes before the OAuth access token expires.

**Example**

```js
var prevRefresh = byu.auth.autoRefresh;
byu.auth.autoRefresh = -5;      // refresh the access token 5 minutes before expiration
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

Set the brownie mode within the page to either “manual” or “always” using `<meta name=“wabs-brownie” content=“manual”>` or `<meta name=“wabs-brownie” content=“always”>`

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
A function to navigate to a URL and if that URL is a legacy app then send the legacy app the brownie data. This function will automatically be called if the brownie mode is set to “always” and a link is clicked that points to a legacy application.

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