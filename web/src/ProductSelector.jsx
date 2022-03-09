import React, { useReducer, useEffect } from "react";
import { useInstallerClient } from "./context/installer";

import {
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalVariant
} from "@patternfly/react-core";

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

  useEffect(async () => {
    const products = await client.getProducts();
    const current = await client.getSelectedProduct();
    dispatch({
      type: "LOAD",
      payload: { products, current, initial: current }
    });
  }, []);

  const open = () => dispatch({ type: "OPEN" });

  const cancel = () => dispatch({ type: "CANCEL" });

  const accept = async () => {
    // TODO: handle errors
    await client.selectProduct(product);
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

      <Modal
        isOpen={isFormOpen}
        showClose={false}
        variant={ModalVariant.small}
        title="Product Selector"
        actions={[
          <Button key="confirm" variant="primary" onClick={accept}>
            Confirm
          </Button>,
          <Button key="cancel" variant="link" onClick={cancel}>
            Cancel
          </Button>
        ]}
      >
        <Form>
          <FormGroup fieldId="product" label="Select the product to be installed">
            {buildSelector()}
          </FormGroup>
        </Form>
      </Modal>
    </>
  );
}
