# Debugging

This document describes some tips for debugging problems in Agama.

## The Web Frontend

Cockpit by default does not log any debugging messages, but you can enable it
manually. After enabling the debug mode you can see all DBus traffic, executed
commands and more.

To enable it open the developer tools in the browser (usually the `F12` or
`Ctrl+Shift+I` key shortcut), switch to the console and run this command:

```js
window.sessionStorage.debugging = "all"
```

This enables logging for all Cockpit parts. If the log is too verbose you can
enable just some specific parts:

`"channel"` - log the websocket traffic, includes most of the Cockpit traffic  
`"dbus"` - log the DBus traffic when using the [Cockpit DBus API](
https://cockpit-project.org/guide/latest/cockpit-dbus.html)  
`"http"` - log HTTP traffic for the [Cockpit HTTP client](
https://cockpit-project.org/guide/latest/cockpit-http.html)  
`"spawn"` - log executed commands and results when using [Cockpit process
spawning](https://cockpit-project.org/guide/latest/cockpit-spawn)

To turn off the debugging set it to the `undefined` value:

```js
window.sessionStorage.debugging = undefined
```

The setting is stored in the session storage which means the value is kept
between page reloads and each browser tab uses a different instance.

:warning: *Warning: Cockpit logs all data transferred between the browser
and the server including sensitive data like passwords, registration codes or
similar! Be careful when sharing the Cockpit logs!* :warning:
