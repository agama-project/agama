# D-Installer Web-Based UI

This application offers a web-based UI which connects to [yastd](file:../yastd) through D-bus, using
[Cockpit's infrastructure](https://cockpit-project.org/guide/latest/api-base1.html), and drives the
installation process. It is built with the popular [React JavaScript library](https://reactjs.org/)
and it was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Tasks

Most of the tasks you can run through `npm` are provided by Create React App (see the
[documentation](https://create-react-app.dev/docs/available-scripts/) for further details). However,
we have added a few more tasks on our own. So let's recap all the available task (they are defined
under the `scripts` key in the [package.json file](./package.json).

* `npm start`: runs the application in development mode on `http://localhost:3000`. If possible, it
  opens the browser. The page will reload if change the source code.
* `npm test`: launches the test runner in interactive watch mode. See [running
  tests](https://create-react-app.dev/docs/running-tests) for more information.
* `npm run build`: builds the application for production in the `build` folder.
* `npm run lint`: runs [ESLint](https://eslint.org/) on the source code.
* `npm run prettier`: runs [Prettier](https://prettier.io/) and modifies the code to stick to the
  [rules](./.prettierrc).

Additionally, there a special [`npm run
eject`](https://create-react-app.dev/docs/available-scripts/#npm-run-eject) exists. It removes the
dependency on Create React App, but it is a one-way operation that should not use unless it is
strictly necessary.
