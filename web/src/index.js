/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import { HashRouter, Routes, Route } from "react-router-dom";
import { RootProviders } from "~/context/root";

/**
 * Import PF base styles before any JSX since components coming from PF may
 * import styles dependent on variables and rules previously defined there.
 */
import "@patternfly/patternfly/patternfly-base.scss";

import App from "~/App";
import Main from "~/Main";
import Protected from "~/Protected";
import { OverviewPage } from "~/components/overview";
import { ProductPage, ProductSelectionPage } from "~/components/product";
import { SoftwarePage } from "~/components/software";
import { ProposalPage as StoragePage, ISCSIPage, DASDPage, ZFCPPage } from "~/components/storage";
import { UsersPage } from "~/components/users";
import { L10nPage } from "~/components/l10n";
import { LoginPage } from "./components/core";
import { NetworkPage } from "~/components/network";
import { TerminalPage } from "~/components/core";

/**
 * As JSX components might import CSS stylesheets, our styles must be imported
 * after them to preserve our overrides (e.g., PF overrides).
 *
 * Because mini-css-extract-plugin maintains the order of the imported CSS,
 * adding the overrides here ensures the overrides will be placed appropriately
 * at the end of our stylesheet when it extracts the CSS from dist/index.js
 *
 * See https://github.com/cockpit-project/starter-kit/blob/aeb81718e75b54e5d50ee450fe2abfbcfa58f5e6/src/index.js
 */
import "~/assets/styles/index.scss";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <RootProviders>
    <HashRouter>
      <Routes>
        <Route path="/login" exact element={<LoginPage />} />
        <Route path="/" element={<Protected />}>
          <Route path="/" element={<App />}>
            <Route path="/" element={<Main />}>
              <Route index element={<OverviewPage />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/product" element={<ProductPage />} />
              <Route path="/l10n" element={<L10nPage />} />
              <Route path="/software" element={<SoftwarePage />} />
              <Route path="/storage" element={<StoragePage />} />
              <Route path="/storage/iscsi" element={<ISCSIPage />} />
              <Route path="/storage/dasd" element={<DASDPage />} />
              <Route path="/storage/zfcp" element={<ZFCPPage />} />
              <Route path="/network" element={<NetworkPage />} />
              <Route path="/users" element={<UsersPage />} />
            </Route>
            <Route path="products" element={<ProductSelectionPage />} />
            <Route path="terminal" element={<TerminalPage />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  </RootProviders>
);
