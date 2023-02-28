# D-Installer Web-Based UI

This Cockpit modules offers a UI to the [D-Installer service](file:../service). The code is based on
[Cockpit's Starter Kit
(b2379f7)](https://github.com/cockpit-project/starter-kit/tree/b2379f78e203aab0028d8548b39f5f0bd2b27d2a).

## Development

There are basically two ways how to develop the D-Installer fronted. You can
override the original Cockpit plugins with your own code in your `$HOME` directory
or you can run a development server which works as a proxy and sends the Cockpit
requests to a real Cockpit server.

The advantage of using the development server is that you can use the
[Hot Module Replacement](https://webpack.js.org/concepts/hot-module-replacement/)
feature for automatically updating the code and stylesheet in the browser
without reloading the page.

### Overriding the Cockpit Plugin

Cockpit searches for modules in the `$HOME/.local/share/cockpit` directory of the logged in user,
which is really handy when working on a module. To make the module available to Cockpit, you can
link your build folder (`dist`) or just rely on the `devel-install` task:

```
    make devel-install
```

Then you can visit the D-installer module through the following URL:

http://localhost:9090/cockpit/@localhost/d-installer/index.html.

Bear in mind that if something goes wrong while building the application (e.g., the linter fails),
the link will not be created.

To automatically rebuild the sources after any change you can run

```
    npm run watch
```

*But do not forget that you have to reload the code in your browser manually after each change!*

### Using a development server

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

This can work also remotely, with a D-Installer instance running in a different
machine (a virtual machine as well). In that case run

```
    COCKPIT_TARGET=<IP> npm run server -- --open
```

Where  `COCKPIT_TARGET` is the IP address or hostname of the running D-Installer
instance. This is especially useful if you use the Live ISO which does not contain
any development tools, you can develop the web frontend easily from your workstation.

## JSDoc Documentation

This project uses [TypeDoc](https://typedoc.org/) to generate the API documentation. The `jsdoc`
task generates the documentation to the `jsout.out` directory. If you need to adjust any TypeDoc
option, please check the `typedocOptions` key in the `tsconfig.js` file.

```
npm run jsdoc
xdg-open jsdoc.out/index.html
```

GitHub Actions will automatically publish the result to <https://d-installer-frontend.surge.sh/>.

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
- [PatternFly documentation](https://www.patternfly.org/v4/)
- [PatternFly icons](https://patternfly-react.surge.sh/icons/)
