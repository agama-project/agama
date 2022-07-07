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

const SoftwareContext = React.createContext();

function SoftwareProvider({ children }) {
  const [products, setProducts] = React.useState(undefined);
  const [selectedId, setSelectedId] = React.useState(undefined);

  const value = [products, setProducts, selectedId, setSelectedId];
  return <SoftwareContext.Provider value={value}>{children}</SoftwareContext.Provider>;
}

function useSoftware() {
  const context = React.useContext(SoftwareContext);

  if (!context) {
    throw new Error("useSoftware must be used within a SoftwareProvider");
  }

  const [products, setProducts, selectedId, setSelectedId] = context;

  let selectedProduct = selectedId;
  if (selectedId) {
    selectedProduct = products.find(p => p.id === selectedId);
  }

  const setSelectedProduct = React.useMemo(() => (product) => {
    if (typeof product === "object") {
      setSelectedId(product?.id || null);
    } else {
      setSelectedId(product);
    }
  }, [setSelectedId]);

  return {
    products,
    setProducts,
    selectedProduct,
    setSelectedProduct
  };
}

export { SoftwareProvider, useSoftware };
