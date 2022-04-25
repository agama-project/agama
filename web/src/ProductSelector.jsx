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

import React, { useReducer, useEffect } from "react";
import { useInstallerClient } from "./context/installer";

import {
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
} from "@patternfly/react-core";

import Popup from './Popup';

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD": {
      return { ...state, ...action.payload };
    }
    case "ACCEPT": {
      return { ...state, isFormOpen: false };
    }

    case "CANCEL": {
      return { ...state, isFormOpen: false, current: state.initial };
    }

    case "CHANGE": {
      return { ...state, current: action.payload };
    }

    case "OPEN": {
      return { ...state, isFormOpen: true };
    }

    default: {
      return state;
    }
  }
};

const initialState = {
  products: [],
  initial: null,
  current: null,
  isFormOpen: false
};

export default function ProductSelector() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { current: product, products, isFormOpen } = state;

  useEffect(() => {
    const loadProducts = async () => {
      const products = await client.software.getProducts();
      const current = await client.software.getSelectedProduct();
      dispatch({
        type: "LOAD",
        payload: { products, current, initial: current }
      });
    };

    loadProducts().catch(console.error);
  }, [client.software]);

  const open = () => dispatch({ type: "OPEN" });

  const cancel = () => dispatch({ type: "CANCEL" });

  const accept = async () => {
    // TODO: handle errors
    await client.software.selectProduct(product);
    dispatch({ type: "ACCEPT" });
  };

  const label = () => {
    const selectedProduct = products.find(p => p.id === product);
    return selectedProduct ? selectedProduct.name : "Select product";
  };

  const buildSelector = () => {
    const selectorOptions = products.map((p, idx) => (
      <FormSelectOption key={idx} value={p.id} label={p.name} />
    ));

    return (
      <FormSelect
        id="product"
        value={product}
        onChange={v => dispatch({ type: "CHANGE", payload: v })}
        aria-label="product"
      >
        {selectorOptions}
      </FormSelect>
    );
  };

  return (
    <>
      <Button variant="link" onClick={open}>
        {label()}
      </Button>

      <Popup
        isOpen={isFormOpen}
        aria-label="Product Selector"
        onConfirm={accept}
        onCancel={cancel}
      >
        <Form>
          <FormGroup fieldId="product" label="Product">
            {buildSelector()}
          </FormGroup>
        </Form>
      </Popup>
    </>
  );
}
