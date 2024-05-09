/*
 * Copyright (c) [2024] SUSE LLC
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
import { createHashRouter } from "react-router-dom";
import App from "~/App";
import Main from "~/Main";
import { OverviewPage } from "~/components/overview";
import { ProductPage, ProductSelectionPage } from "~/components/product";
import { SoftwarePage } from "~/components/software";
import { ProposalPage as StoragePage, ISCSIPage, DASDPage, ZFCPPage } from "~/components/storage";
import { UsersPage } from "~/components/users";
import { L10nPage } from "~/components/l10n";
import { NetworkPage } from "~/components/network";

const routes = [
  {
    path: "/",
    element: <App />,
    children: [
      {
        element: <Main />,
        children: [
          {
            index: true,
            element: <OverviewPage />
          },
          {
            path: "overview",
            element: <OverviewPage />
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
        ]
      },
      {
        path: "products",
        element: <ProductSelectionPage />
      }
    ]
  }
];

const router = createHashRouter(routes);

export { routes, router };
