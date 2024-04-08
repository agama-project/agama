# Agama Web UI

The Agama web user interface is a React-based application that offers a user
interface to the [Agama service](file:../service).

## Development

The easiest way to work on the Agama Web UI is to use the development server.
The advantage is that you can use the [Hot Module Replacement] (https://
webpack.js.org/concepts/hot-module-replacement/) feature for automatically
updating the code and stylesheet in the browser without reloading the page.

### Using a development server

To start the [webpack-dev-server](https://github.com/webpack/webpack-dev-server)
use this command:

```
    npm run server -- --open
```

The extra `--open` option automatically opens the server page in your default
web browser. In this case the server will use the `https://localhost:8080` URL
and expects a running `agama-web-server` at `https://localhost:9090`.

This can work also remotely, with a Agama instance running in a different
machine (a virtual machine as well). In that case run

```
    AGAMA_SERVER=<IP> npm run server -- --open
```

Where  `AGAMA_SERVER` is the IP address, the hostname or the full URL of the
running Agama server instance. This is especially useful if you use the Live ISO
which does not contain any development tools, you can develop the web frontend
easily from your workstation.

Example of running from different machine:

```
  # backend machine
  # using ip of machine instead of localhost is important to be network accessible
  agama-web-server serve --address 10.100.1.1:3000

  # frontend machine
  # ESLINT=0 is useful to ignore linter problems during development
  ESLINT=0 AGAMA_SERVER=10.100.1.1:3000 npm run server
```

### Debugging Hints

There are several places to look when something does not work and requires debugging.
The first place is the browser's console which can give
some hints. The second location to check for errors or warnings is output of `npm run server`
where you can find issues when communicating with the backend. And last but on least is
journal on backend machine where is logged backend activity `journalctl -b`.

### Special Environment Variables

`AGAMA_SERVER` - When running the development server set up a proxy to
the specified Agama web server. See the [using a development server]
(#using-a-development-server) section above.

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

- [Webpack documentation](https://webpack.js.org/configuration/)
- [PatternFly documentation](https://www.patternfly.org)
- [Material Symbols (aka icons)](https://fonts.google.com/icons)
