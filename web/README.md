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

While working on the code, you might want to run the following command to refresh the build
everytime you save a change:

```
    npm run watch
```

However, there is no hot or live reloading feature, so you need to reload the code in your browser.
