import { useState } from 'react';

import {
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalVariant
} from "@patternfly/react-core"

export default function ProductSelector({ value, options = {}, onChange = () => {} }) {
  const [isFormOpen, setFormOpen] = useState(false);
  const [product, setProduct] = useState(value);
  const products = Object.values(options);

  const onOpen = () => {
    setProduct(value);
    setFormOpen(true);
  }

  const onClose = () => {
    setFormOpen(false);
  }

  const applyChanges = () => {
    onChange(product);
    onClose();
  }

  const label = () => {
    if (products.length === 0) {
      return value;
    }

    const selectedProduct = products.find(p => p.name === value)

    return selectedProduct ? selectedProduct.display_name : value;
  }

  const buildSelector = () => {
    const selectorOptions = products.map(p => (
      <FormSelectOption key={p.name} value={p.name} label={p.display_name} />
    ));

    return (
      <FormSelect
        value={product}
        onChange={(value) => setProduct(value)}
        aria-label="product"
      >
        {selectorOptions}
      </FormSelect>
    );
  };

  return (
    <>
      <Button variant="link" onClick={onOpen}>
        {label()}
      </Button>

      <Modal
        isOpen={isFormOpen}
        showClose={false}
        variant={ModalVariant.small}
        title="Product Selector"
        actions={[
          <Button key="confirm" variant="primary" onClick={applyChanges}>
            Confirm
          </Button>,
          <Button key="cancel" variant="link" onClick={onClose}>
            Cancel
          </Button>
        ]}
      >
        <Form>
          <FormGroup
            fieldId="product"
            label="Select the product to be installed"
          >
            { buildSelector() }
          </FormGroup>
        </Form>
      </Modal>
    </>
  )
}
