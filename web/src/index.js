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

import { createHashRouter, RouterProvider } from "react-router-dom";
import { AgamaProviders } from "~/context/agama";

/**
 * Import PF base styles before any JSX since components coming from PF may
 * import styles dependent on variables and rules previously defined there.
 */
import "@patternfly/patternfly/patternfly-base.scss";

import App from "~/App";
import Main from "~/Main";
import DevServerWrapper from "~/DevServerWrapper";
import { Overview } from "~/components/overview";
import { ProductPage, ProductSelectionPage } from "~/components/product";
import { SoftwarePage } from "~/components/software";
import { ProposalPage as StoragePage, ISCSIPage, DASDPage, ZFCPPage } from "~/components/storage";
import { UsersPage } from "~/components/users";
import { L10nPage } from "~/components/l10n";
import { NetworkPage } from "~/components/network";
import { IssuesPage } from "~/components/core";

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

/**
 * When running in the development server add a special login wrapper which
 * checks whether the user is authenticated. When building the code outside
 * the development server an empty fragment (<></>) is used which is no-op.
 * In the production builds the DevServerWrapper code is completely omitted.
 */
const LoginWrapper = (process.env.WEBPACK_SERVE) ? DevServerWrapper : React.Fragment;

const container = document.getElementById("root");
const root = createRoot(container);

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        element: <Main />,
        children: [
          {
            index: true,
            element: <Overview />
          },
          {
            path: "overview",
            element: <Overview />
          },
          {
            path: "product",
            element: <ProductPage />
          },
          {
            path: "l10n",
            element: <L10nPage />
          },
          {
            path: "software",
            element: <SoftwarePage />
          },
          {
            path: "storage",
            element: <StoragePage />,
            children: [
              {
                path: "iscsi",
                element: <ISCSIPage />
              },
              {
                path: "dasd",
                element: <DASDPage />
              },
              {
                path: "zfcp",
                element: <ZFCPPage />
              }
            ]
          },
          {
            path: "network",
            element: <NetworkPage />
          },
          {
            path: "users",
            element: <UsersPage />
          },
          {
            path: "issues",
            element: <IssuesPage />
          }
        ]
      },
      {
        path: "products",
        element: <ProductSelectionPage />
      }
    ]
  }
]);

root.render(
  <LoginWrapper>
    <AgamaProviders>
      <RouterProvider router={router} />
    </AgamaProviders>
  </LoginWrapper>
);
