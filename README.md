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

## Client Web Application Authentication / Authorization Tools

If the authenticate option is set to either "manual" or "always" then your client application will automatically get access to a few additional tools:
  
### HTML Meta Tags

You can add meta tags to your HTML document that will alter how the server interacts with your file.

#### wabs-auth

Set the authenticate mode within the HTML page to either “manual” or “always” using ```<meta name=“wabs-auth” content=“manual”>``` or ```<meta name=“wabs-auth” content=“always”>```

#### wabs-auth-refresh

Set the authentication auto refresh using ```<meta name=“wabs-auth-refresh” content=“0”>``` where the content value is a number.

- If the number is zero then authentication auto refresh will be disabled.
- If the number is positive then the auto refresh will occur number of minutes specified.
- If the number is negative then the refresh will occur that many number of minutes before the OAuth access token expires.
  
### JavaScript
  
Your client application will have access to two global objects:
  
#### byu.user

An object with data about the authenticated user.
  
#### byu.auth

Will have the following properties and functions:
  
##### accessToken

[readonly] The OAuth access token.
  
##### autoRefresh

The authentication auto refresh interval.If the number is zero then authentication auto refresh will be disabled. If the number is positive then the auto refresh will occur number of minutes specified. If the number is negative then the refresh will occur that many number of minutes before the OAuth access token expires.
  
##### expired

[readonly] A boolean indicating whether the OAuth access token has expired.
  
##### expires

[readonly] The number of milliseconds until the OAuth token expires. Note that this will only be accurate to 60000 milliseconds.login() - A function that takes no parameters and will log the user in.
  
##### logout ( [casLogout  [,  redirect]  ] )

A function that will log the user out.

**Parameters**

- **casLogout** - An *optional boolean* that specifies whether to perform a CAS logout. Defaults to `true`.
- **redirect** - An *optional url* or *false* that is used to specify the URL of where to direct the client after logout. If not specified then the client will be redirected to the current page. If set to false then no redirect will occur.

**Returns** undefined
  
##### refresh( [ callback ] )
A function that will refresh the OAuth access token.

**Parameters**

- **callback** - An *optional function* that will be called once the refresh completes. An `Error` object will be passed as the first parameter if the refresh fails, otherwise null will be passed as the parameter.
  
**Returns** undefined

##### refreshToken

[readonly] The encrypted OAuth refresh token.

## Client Web Application Brownie Tools

If the brownie option is set to either “always” or "manual"then your client application will automatically get access to a few additional tools:
  
### HTML Meta Tags

#### wabs-brownie

Set the brownie mode within the page to either “manual” or “always” using `<meta name=“wabs-brownie” content=“manual”>` or `<meta name=“wabs-brownie” content=“always”>`
  
### JavaScript
  
Your client application will have access to the byu.brownie object. This object has the following functions:

#### byu.brownie
  
##### clear()

A function that will wipe out the active brownie data.
  
##### get( [ key ] )

A function to get a brownie value with the key that is specified as the first parameter. If the key is omitted then you will get back a copy of the entire brownie data object.

**Parameters**

- **key** - An *optional string* that represents the key of the brownie data to get.

**Returns** A string, number, or the entire brownie object (if the *key* parameter is omitted).

##### navigateTo( url, [, target ] )
A function to navigate to a URL and if that URL is a legacy app then send the legacy app the brownie data. This function will automatically be called if the brownie mode is set to “always” and a link is clicked that points to a legacy application.

**Parameters**

- **url** - A *required string* specifying where to navigate to.
- **target** - An *optional string* specifying the link target. For example, you might set it to `_blank`.

**Returns** undefined
  
##### set( key,  value )

A function to set a brownie property to a value.

**Parameters**

- **key** - A *required string* for the brownie key to set.
- **value** - A *required string or integer* for the value to set.
 
##### unset( key )

A function to remove a brownie property value. The first parameter is the key.

**Parameters**

- **key** - A *required string* for the brownie key to remove.