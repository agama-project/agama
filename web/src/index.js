/*
 * Copyright (c) [2022] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React, { StrictMode } from "react";
import ReactDOM from "react-dom";
import "core-js/stable";
import "regenerator-runtime/runtime";

import "@patternfly/patternfly/patternfly.css";

import App from "./App";
import { InstallerClientProvider } from "./context/installer";
import { AuthProvider } from "./context/auth";
import { createClient } from "./client";

/*
 * PF4 overrides need to come after the JSX components imports because
 * these are importing CSS stylesheets that we are overriding
 * Having the overrides here will ensure that when mini-css-extract-plugin will extract the CSS
 * out of the dist/index.js and since it will maintain the order of the imported CSS,
 * the overrides will be correctly in the end of our stylesheet.
 */

// import "@fontsource/lato/400.css";
// import "@fontsource/lato/400-italic.css";
// import "@fontsource/lato/700.css";
// import "@fontsource/poppins/300.css";
// import "@fontsource/poppins/500.css";
// import "@fontsource/roboto-mono/400.css";

import "./patternfly.scss";

const client = createClient();

ReactDOM.render(
  <StrictMode>
    <InstallerClientProvider client={client}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </InstallerClientProvider>
  </StrictMode>,
  document.getElementById("root")
);
