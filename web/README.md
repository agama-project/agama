# Agama Web-Based UI

This Cockpit modules offers a UI to the [Agama service](file:../service). The code is based on
[Cockpit's Starter Kit
(b2379f7)](https://github.com/cockpit-project/starter-kit/tree/b2379f78e203aab0028d8548b39f5f0bd2b27d2a).

## Development

TODO: update when new way is clear how to do
There are basically two ways how to develop the Agama fronted. You can
override the original Cockpit plugins with your own code in your `$HOME` directory
or you can run a development server which works as a proxy and sends the Cockpit
requests to a real Cockpit server.

The advantage of using the development server is that you can use the
[Hot Module Replacement](https://webpack.js.org/concepts/hot-module-replacement/)
feature for automatically updating the code and stylesheet in the browser
without reloading the page.

### Using a development server

TODO: update when new way is clear how to do
To start the [webpack-dev-server](https://github.com/webpack/webpack-dev-server)
use this command:

```
    npm run server -- --open
```

The extra `--open` option automatically opens the server page in your default
web browser. In this case the server will use the `https://localhost:8080` URL
and expects a running Cockpit instance at `https://localhost:9090`.

At the first start the development server generates a self-signed SSL
certificate, you have to accept it in the browser. The certificate is saved to
disk and is used in the next runs so you do not have to accept it again.

This can work also remotely, with a Agama instance running in a different
machine (a virtual machine as well). In that case run

```
    COCKPIT_TARGET=<IP> npm run server -- --open
```

Where  `COCKPIT_TARGET` is the IP address or hostname of the running Agama
instance. This is especially useful if you use the Live ISO which does not contain
any development tools, you can develop the web frontend easily from your workstation.

### Special Environment Variables

`COCKPIT_TARGET` - When running the development server set up a proxy to the
specified Cockpit server. See the [using a development
server](#using-a-development-server) section above.

`LOCAL_CONNECTION` - Force behaving as in a local connection, useful for
development or testing some Agama features. For example the keyboard layout
switcher is displayed only in local installation because it cannot work in
remote connection. This option will force displaying it even in a remote
connection.

## TypeDoc Documentation

This project uses [TypeDoc](https://typedoc.org/) to generate the API documentation. The `typedoc`
task generates the documentation to the `typedoc.out` directory. If you need to adjust any TypeDoc
option, please check the [`typedoc.json` file](./typedoc.json).

```
npm run typedoc
xdg-open typedoc.out/client/index.html
xdg-open typedoc.out/components/index.html
```

GitHub Actions will automatically publish the result to <https://agama-frontend.surge.sh/>.

## Type-Checking Support

This module started as a JavaScript-only project. We have decided to add type-checking support, but
instead of converting the code to TypeScript, we prefer to use [TypeScript support for JSDoc
annotations](https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html).

Run the following command to check the types:

```
npm run check-types
```

Not our JavaScript code is properly documented yet, so type-checking is an opt-in feature by now. If
you want a JavaScript file to be type-checked, please add a `// @ts-check` comment before any code.

### Links

- [Cockpit developer documentation](https://cockpit-project.org/guide/latest/development)
- [Webpack documentation](https://webpack.js.org/configuration/)
- [PatternFly documentation](https://www.patternfly.org)
- [Material Symbols (aka icons)](https://fonts.google.com/icons)
