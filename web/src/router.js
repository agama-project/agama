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
import MainLayout from "~/components/layout/Main";
import SimpleLayout from "./SimpleLayout";
import { LoginPage } from "~/components/core";
import { OverviewPage } from "~/components/overview";
import l10nRoutes from "~/routes/l10n";
import networkRoutes from "~/routes/network";
import productsRoutes from "~/routes/products";
import storageRoutes from "~/routes/storage";
import softwareRoutes from "~/routes/software";
import usersRoutes from "~/routes/users";
import { N_ } from "~/i18n";

const PATHS = {
  root: "/",
  login: "/login",
  overview: "/overview",
};

const rootRoutes = () => [
  {
    path: "/overview",
    element: <OverviewPage />,
    handle: { name: N_("Overview"), icon: "list_alt" },
  },
  l10nRoutes(),
  networkRoutes(),
  storageRoutes(),
  softwareRoutes(),
  usersRoutes(),
];

const protectedRoutes = () => [
  {
    path: PATHS.root,
    element: <App />,
    children: [
      {
        element: <MainLayout />,
        children: [
          {
            index: true,
            element: <OverviewPage />,
          },
          ...rootRoutes(),
        ],
      },
      {
        element: <SimpleLayout showInstallerOptions />,
        children: [productsRoutes()],
      },
    ],
  },
];

const router = () =>
  createHashRouter([
    {
      path: PATHS.login,
      exact: true,
      element: <SimpleLayout />,
      children: [
        {
          index: true,
          element: <LoginPage />,
        },
      ],
    },
    {
      path: PATHS.root,
      element: <Protected />,
      children: [...protectedRoutes()],
    },
  ]);

export { router, rootRoutes, PATHS };
