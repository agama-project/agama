import React, { useState } from "react";

import {
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalVariant
} from "@patternfly/react-core";

export default function TargetSelector({ target, targets, onAccept }) {
  const [value, setValue] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  const open = () => {
    setIsFormOpen(true);
    setValue(target);
  };

  const accept = () => {
    // TODO: handle errors
    onAccept(value);
    setIsFormOpen(false);
  };

  const cancel = () => setIsFormOpen(false);

  const buildSelector = () => {
    const selectorOptions = targets.map(target => {
      return <FormSelectOption key={target} value={target} label={target} />;
    });

    return (
      <FormSelect id="target" value={value} onChange={setValue} aria-label="target">
        {selectorOptions}
      </FormSelect>
    );
  };

  return (
    <>
      <Button variant="link" onClick={open}>
        {target}
      </Button>

      <Modal
        isOpen={isFormOpen}
        showClose={false}
        variant={ModalVariant.small}
        title="Target Selector"
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
          <FormGroup
            fieldId="target"
            label="Select target"
            helperText="Product will be installed in selected target"
          >
            {buildSelector()}
          </FormGroup>
        </Form>
      </Modal>
    </>
  );
}
