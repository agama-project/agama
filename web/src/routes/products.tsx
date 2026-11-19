/*
 * Copyright (c) [2024-2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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
import { Navigate, useLocation } from "react-router";
import { Route } from "~/types/routes";
import { PRODUCT as PATHS, QUICK_SETUP } from "~/routes/paths";

/** Product selection lives in Quick setup now, keeping the query (e.g. byUser). */
const ToQuickSetup = () => {
  const { search } = useLocation();
  return <Navigate to={{ pathname: QUICK_SETUP.root, search }} replace />;
};

const routes = (): Route => ({
  path: PATHS.root,
  children: [
    {
      index: true,
      element: <ToQuickSetup />,
    },
  ],
});

export default routes;
