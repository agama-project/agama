# Development Notes

## Development Mode

As explained in the [main README](README.md), you can run the web UI in *development mode*, so the
code gets reloaded everytime you make a change. In that scenario, the code is served by `npm`
instead of `cockpit-ws`.

However, the UI needs to access `cockpit-ws` through a different port to log in and interact with
the underlying system. It happens automatically thanks to a [proxy](./web/src/setupProxy.js) which
is configured automatically. If you need to proxy other URLs, just add them to the configuration.

## npm start

`npm start` cleans up the screen during the initialization. It might cause that you miss some
important messages, like the proxy configuration. If you need to check those messages, you can
use this command instead:

    $ COLOR=1 npm start | cat
