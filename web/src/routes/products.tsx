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
import { ProductSelectionPage, ProductSelectionProgress } from "~/components/product";
import { Route } from "~/types/routes";

const PATHS = {
  root: "/products",
  changeProduct: "/products",
  progress: "/products/progress",
};

const routes = (): Route => ({
  path: PATHS.root,
  children: [
    {
      index: true,
      element: <ProductSelectionPage />,
    },
    {
      path: PATHS.progress,
      element: <ProductSelectionProgress />,
    },
  ],
});

export default routes;
export { PATHS };
