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
import Protected from "~/Protected";
import Root from "~/Root";
import SimpleLayout from "./SimpleLayout";
import { Page, LoginPage } from "~/components/core";
import { OverviewPage } from "~/components/overview";
import { ProductRegistrationPage, ProductSelectionPage } from "~/components/product";
import { _ } from "~/i18n";
import overviewRoutes from "~/components/overview/routes";
import l10nRoutes from "~/components/l10n/routes";
import networkRoutes from "~/components/network/routes";
import storageRoutes from "~/components/storage/routes";
import softwareRoutes from "~/components/software/routes";
import usersRoutes from "~/components/users/routes";
import {
  registerRoute as productRegistrationRoute,
  selectionRoute as productSelectionRoute
} from "~/components/product/routes";

const rootRoutes = [
  overviewRoutes,
  l10nRoutes,
  networkRoutes,
  storageRoutes,
  softwareRoutes,
  usersRoutes,
  productRegistrationRoute
];

const protectedRoutes = [
  {
    path: "/",
    element: <App />,
    children: [
      {
        element: <Root />,
        children: [
          {
            index: true,
            element: <OverviewPage />
          },
          ...rootRoutes
        ]
      },
      {
        element: <SimpleLayout />,
        children: [
          {
            path: "products",
            element: <ProductSelectionPage />
          },
          productSelectionRoute
        ]
      }
    ]
  }
];

const routes = [
  {
    path: "/login",
    exact: true,
    element: <SimpleLayout />,
    children: [
      {
        index: true,
        element: <LoginPage />
      }
    ]
  },
  {
    path: "/",
    element: <Protected />,
    children: [...protectedRoutes]
  }
];

const router = createHashRouter(routes);

export {
  router,
  rootRoutes
};
