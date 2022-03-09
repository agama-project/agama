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
