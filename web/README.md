# D-Installer Web-Based UI

This application offers a web-based UI which connects to [yastd](file:../yastd) through D-bus, using
[Cockpit's infrastructure](https://cockpit-project.org/guide/latest/api-base1.html), and drives the
installation process. It is built with the popular [React JavaScript library](https://reactjs.org/)
and it was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Tasks

These are the available tasks (they are defined under the `scripts` key in the
[package.json file](./package.json).

* `npm run dev`: runs the application in development mode on `http://localhost:3000`. The page will
  reload if change the source code.
* `npm test`: launches the test runner in interactive watch mode. See [running
  tests](https://create-react-app.dev/docs/running-tests) for more information.
* `npm run build`: builds the application for production in the `build` folder.
* `npm run lint`: runs [ESLint](https://eslint.org/) on the source code.
* `npm run format`: formats the code using [Prettier](https://prettier.io/) to
  stick to [our rules](./.prettierrc).
