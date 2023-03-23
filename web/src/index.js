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

import React from "react";
import { createRoot } from "react-dom/client";
import "core-js/stable";
import "regenerator-runtime/runtime";

import { HashRouter, Routes, Route } from "react-router-dom";
import { InstallerClientProvider } from "~/context/installer";
import { SoftwareProvider } from "~/context/software";
import { createClient } from "~/client";

import "@patternfly/patternfly/patternfly-base.scss";
import "~/assets/styles/index.scss";

import App from "~/App";
import Main from "~/Main";
import DevServerWrapper from "~/DevServerWrapper";
import { Overview } from "~/components/overview";
import { ProductSelectionPage } from "~/components/software";
import { ProposalPage as StoragePage, ISCSIPage } from "~/components/storage";
import { UsersPage } from "~/components/users";
import { L10nPage } from "~/components/l10n";
import { NetworkPage } from "~/components/network";

// When running in the development server add a special login wrapper which
// checks whether the user is authenticated. When building the code outside
// the development server an empty fragment (<></>) is used which is no-op.
// In the production builds the DevServerWrapper code is completely omitted.
const LoginWrapper = (process.env.WEBPACK_SERVE) ? DevServerWrapper : React.Fragment;

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <LoginWrapper>
    <InstallerClientProvider client={createClient}>
      <SoftwareProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<App />}>
              <Route path="/" element={<Main />}>
                <Route index element={<Overview />} />
                <Route path="/overview" element={<Overview />} />
                <Route path="/l10n" element={<L10nPage />} />
                <Route path="/storage" element={<StoragePage />} />
                <Route path="/storage/iscsi" element={<ISCSIPage />} />
                <Route path="/network" element={<NetworkPage />} />
                <Route path="/users" element={<UsersPage />} />
              </Route>
              <Route path="products" element={<ProductSelectionPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </SoftwareProvider>
    </InstallerClientProvider>
  </LoginWrapper>
);
