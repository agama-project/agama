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
import { Page } from "~/components/core";
import ProductSelectionPage from "./ProductSelectionPage";
import ProductRegistrationPage from "./ProductRegistrationPage";
import { _ } from "~/i18n";

const registerRoute = {
  path: "/product/register",
  element: <Page />,
  handle: {
    name: _("Product registration"),
    icon: "inventory_2",
    hidden: true
  },
  children: [
    {
      index: true,
      element: <ProductRegistrationPage />
    }
  ]
};

const selectionRoute = {
  path: "/product/select",
  element: <ProductSelectionPage />,
  handle: {
    name: _("Product selection"),
    icon: "inventory_2"
  }
};

export {
  registerRoute,
  selectionRoute,
};
