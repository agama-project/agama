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
import { Outlet, Navigate } from "react-router-dom";
import LoadingEnvironment from "./LoadingEnvironment";
import { useSoftware } from "./context/software";

function Main() {
  const { selectedProduct } = useSoftware();

  if (selectedProduct === null) {
    return <Navigate to="/products" />;
  }

  if (selectedProduct === undefined) {
    return <LoadingEnvironment />;
  }

  return <Outlet />;
}

export default Main;
