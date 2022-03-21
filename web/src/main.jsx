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

import App from "./App";
import { InstallerClientProvider } from "./context/installer";
import { AuthProvider } from "./context/auth";
import { createClient } from "./lib/client";

import Layout from "./layout/Layout";

import "./patternfly.scss";
import "./app.scss";
import "./layout.scss";

const client = createClient();

ReactDOM.render(
  <StrictMode>
    <InstallerClientProvider client={client}>
      <AuthProvider>
        <Layout>
          <App />
        </Layout>
      </AuthProvider>
    </InstallerClientProvider>
  </StrictMode>,
  document.getElementById("root")
);
