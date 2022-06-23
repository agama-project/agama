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

import React, { useEffect, useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useInstallerClient } from "./context/installer";

import LoadingEnvironment from "./LoadingEnvironment";
import Questions from "./Questions";

import './assets/fonts.scss';
import "./app.scss";

// TODO: add documentation
function App() {
  const [product, setProduct] = useState(null);
  const client = useInstallerClient();

  useEffect(() => {
    return client.software.getSelectedProduct()
      .then(setProduct)
      .catch(() => setProduct(undefined));
  }, [client.software]);

  // FIXME: improve this
  if (product === null) return <LoadingEnvironment text="Checking products..." />;

  if (!product) return <Navigate to="products" replace={true} />;

  return (
    <>
      <Questions />
      <Outlet />
    </>
  );
}

export default App;
