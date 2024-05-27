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
import { Page, LoginPage, ProgressText } from "~/components/core";
import { OverviewPage } from "~/components/overview";
import { ProductPage, ProductSelectionPage, ProductRegistrationPage } from "~/components/product";
import { SoftwarePage, SoftwarePatternsSelection } from "~/components/software";
import { L10nPage, LocaleSelection, KeymapSelection, TimezoneSelection } from "~/components/l10n";
import { _ } from "~/i18n";
import networkRoutes from "~/components/network/routes";
import usersRoutes from "~/components/users/routes";
import storageRoutes from "~/components/storage/routes";

// FIXME: think in a better apprach for routes, if any.
// FIXME: think if it worth it to have the routes ready for work with them
// dinamically of would be better to go for an explicit use of them (see
// Root#Sidebar navigation)

const createRoute = (name, path, element, children = [], icon) => (
  {
    path,
    element,
    handle: { name, icon },
    children
  }
);

const overviewRoutes = createRoute(_("Overview"), "overview", <OverviewPage />, [], "list_alt");
const productRoutes = createRoute(_("Product"), "product", <Page title={_("Product")} />, [
  { index: true, element: <ProductPage /> },
  createRoute(_("Change selected product"), "change", <ProductSelectionPage />),
  createRoute(_("Register"), "register", <ProductRegistrationPage />),
], "inventory_2");
const l10nRoutes = createRoute(_("Localization"), "l10n", <Page title={_("Localization")} />, [
  { index: true, element: <L10nPage /> },
  createRoute(_("Select language"), "language/select", <LocaleSelection />),
  createRoute(_("Select keymap"), "keymap/select", <KeymapSelection />),
  createRoute(_("Select timezone"), "timezone/select", <TimezoneSelection />),
], "globe");
const softwareRoutes = createRoute(_("Software"), "software", <Page title={_("Software")} />, [
  { index: true, element: <SoftwarePage /> },
  createRoute(_("Select patterns"), "patterns/select", <SoftwarePatternsSelection />),
], "apps");

const rootRoutes = [
  overviewRoutes,
  productRoutes,
  l10nRoutes,
  networkRoutes,
  storageRoutes,
  softwareRoutes,
  usersRoutes,
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
        path: "products",
        element: <ProductSelectionPage />
      }
    ]
  }
];

const routes = [
  {
    path: "/login",
    exact: true,
    element: <LoginPage />
  },
  {
    path: "/",
    element: <Protected />,
    children: [...protectedRoutes]
  }
];

const router = createHashRouter(routes);

export {
  overviewRoutes,
  l10nRoutes,
  productRoutes,
  softwareRoutes,
  storageRoutes,
  networkRoutes,
  usersRoutes,
  rootRoutes,
  routes,
  router
};
