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

export default function TargetSelector({ value, options = {}, onChange = () => {} }) {
  const [isFormOpen, setFormOpen] = useState(false);
  const [target, setTarget] = useState(value);
  const targets = Object.values(options);

  const onOpen = () => {
    setTarget(value);
    setFormOpen(true);
  }

  const onClose = () => {
    setFormOpen(false);
  }

  const applyChanges = () => {
    onChange(target);
    onClose();
  }

  const buildSelector = () => {
    const selectorOptions = targets.map(target => {
      const { name } = target

      return <FormSelectOption key={name} value={name} label={name} />
    });

    return (
      <FormSelect
        value={target}
        onChange={(value) => setTarget(value)}
        aria-label="target"
      >
        {selectorOptions}
      </FormSelect>
    );
  };

  return (
    <>
      <Button variant="link" onClick={onOpen}>
        {value}
      </Button>

      <Modal
        isOpen={isFormOpen}
        showClose={false}
        variant={ModalVariant.small}
        title="Target Selector"
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
            fieldId="target"
            label="Select target"
            helperText="Product will be installed in selected target"
          >
            { buildSelector() }
          </FormGroup>
        </Form>
      </Modal>
    </>
  )
}
