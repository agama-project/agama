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

import "@patternfly/patternfly/patternfly-base.scss";

import { HashRouter, Routes, Route } from "react-router-dom";
import { InstallerClientProvider } from "./context/installer";
import { SoftwareProvider } from "./context/software";
import { createClient } from "./client";

import App from "./App";
import Main from "./Main";
import { Overview } from "@components/core";
import { ProductSelectionPage } from "@components/software";

/*
 * PF4 overrides need to come after the JSX components imports because
 * these are importing CSS stylesheets that we are overriding
 * Having the overrides here will ensure that when mini-css-extract-plugin will extract the CSS
 * out of the dist/index.js and since it will maintain the order of the imported CSS,
 * the overrides will be correctly in the end of our stylesheet.
 */
import "./patternfly.scss";
import "./app.scss";

const client = createClient();

ReactDOM.render(
  <StrictMode>
    <InstallerClientProvider client={client}>
      <SoftwareProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<App />}>
              <Route path="/" element={<Main />}>
                <Route index element={<Overview />} />
                <Route path="/overview" element={<Overview />} />
              </Route>
              <Route path="products" element={<ProductSelectionPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </SoftwareProvider>
    </InstallerClientProvider>
  </StrictMode>,
  document.getElementById("root")
);
