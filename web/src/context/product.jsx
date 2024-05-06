/*
 * Copyright (c) [2023] SUSE LLC
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

import React, { useContext, useEffect, useState } from "react";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "./installer";

/**
 * @typedef {import ("~/client/software").Product} Product
 * @typedef {import ("~/client/software").Registration} Registration
 */

const ProductContext = React.createContext([]);

function ProductProvider({ children }) {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [products, setProducts] = useState(undefined);
  const [selectedId, setSelectedId] = useState(undefined);
  const [registration, setRegistration] = useState(undefined);

  useEffect(() => {
    const load = async () => {
      const productClient = client.product;
      const available = await cancellablePromise(productClient.getAll());
      const selected = await cancellablePromise(productClient.getSelected());
      const registration = await cancellablePromise(productClient.getRegistration());
      setProducts(available);
      setSelectedId(selected);
      setRegistration(registration);
    };

    if (client) {
      load().catch(console.error);
    }
  }, [client, setProducts, setSelectedId, setRegistration, cancellablePromise]);

  useEffect(() => {
    if (!client) return;

    return client.product.onChange(setSelectedId);
  }, [client, setSelectedId]);

  useEffect(() => {
    if (!client) return;

    return client.product.onRegistrationChange(setRegistration);
  }, [client, setRegistration]);

  const value = { products, selectedId, registration };
  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

/**
 * Product context.
 * @function
 *
 * @typedef {object} ProductContext
 * @property {Product[]} products
 * @property {Product|null} selectedProduct
 * @property {string} selectedId
 * @property {Registration} registration
 *
 * @returns {ProductContext}
 */
function useProduct() {
  const context = useContext(ProductContext);

  if (!context) {
    throw new Error("useProduct must be used within a ProductProvider");
  }

  const { products = [], selectedId } = context;
  const selectedProduct = products.find(p => p.id === selectedId) || null;

  return { ...context, selectedProduct };
}

export { ProductProvider, useProduct };
