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

import React, { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import LoadingEnvironment from "./LoadingEnvironment";
import Questions from "./Questions";
import { useInstallerClient } from "./context/installer";

function Main() {
  const [product, setProduct] = useState(undefined);
  const client = useInstallerClient();

  useEffect(() => {
    return client.software.getSelectedProduct().then(setProduct);
  }, [client.software]);

  if (product === null) {
    return <Navigate to="/products" />;
  }

  if (product === undefined) {
    return <LoadingEnvironment />;
  }

  return (
    <>
      <Questions />
      <Outlet context={{product}} />
    </>
  );
}

export default Main;
