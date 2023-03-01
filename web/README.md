# D-Installer Web-Based UI

This Cockpit modules offers a UI to the [D-Installer service](file:../service). The code is based on
[Cockpit's Starter Kit
(b2379f7)](https://github.com/cockpit-project/starter-kit/tree/b2379f78e203aab0028d8548b39f5f0bd2b27d2a).

## Development

Cockpit searches for modules in the `$HOME/.local/share/cockpit` directory of the logged in user,
which is really handy when working on a module. To make the module available to Cockpit, you can
link your build folder (`dist`) or just rely on the `devel-install` task:

```
    make devel-install
```

Bear in mind that if something goes wrong while building the application (e.g., the linter fails),
the link will not be created.

While working on the code, you might want to run the [webpack-dev-server](https://github.com/webpack/webpack-dev-server)
to get the [Hot Module Replacement](https://webpack.js.org/concepts/hot-module-replacement/) enabled.

```
    npm run server
```

Unfortunately, it does not work remotely yet because it needs to connect to
'localhost'. You might workaround it by just using the browser from the VM
through SSH (e.g., "ssh -X yourmachine firefox" -or chromium-).

Thus, if live reloading does not work for you, using the Webpack watcher for
refreshing the build every time a file is changed still being an option through
the command below. But please, do not forget that you have to reload the code
in your browser manually.


```
    npm run watch
```

Whichever option you choose, you can visit the D-installer module through the following URL:

http://localhost:9090/cockpit/@localhost/d-installer/index.html.

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
