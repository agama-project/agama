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

import React, { useState } from "react";
import {
  Alert,
  Form, FormGroup, FormSelect, FormSelectOption
} from "@patternfly/react-core";

import { Popup } from "~/components/core";
import { AuthFields, NodeStartupOptions } from "~/components/storage/iscsi";

export default function LoginForm({ node, onSubmit: onSubmitProp, onCancel }) {
  const [data, setData] = useState({
    username: "",
    password: "",
    reverseUsername: "",
    reversePassword: "",
    startup: "onboot"
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isValidAuth, setIsValidAuth] = useState(true);

  const updateData = (key, value) => setData({ ...data, [key]: value });
  const onStartupChange = v => updateData("startup", v);

  const onSubmit = async (event) => {
    setIsLoading(true);
    event.preventDefault();

    const result = await onSubmitProp(data);

    if (result !== 0) {
      setIsFailed(true);
      setIsLoading(false);
    }
  };

  const startupFormOptions = Object.values(NodeStartupOptions).map((option, i) => (
    <FormSelectOption key={i} value={option.value} label={option.label} />
  ));

  const id = "iscsiLogin";
  const isDisabled = isLoading || !isValidAuth;

  return (
    <Popup isOpen title={`Login ${node.target}`}>
      <Form id={id} onSubmit={onSubmit}>
        { isFailed &&
          <Alert variant="warning" isInline title="Something went wrong">
            <p>Make sure you provide the correct values</p>
          </Alert> }
        <FormGroup fieldId="startup" label="Startup">
          <FormSelect
            id="startup"
            aria-label="startup"
            value={data.startup}
            onChange={onStartupChange}
          >
            {startupFormOptions}
          </FormSelect>
        </FormGroup>
        <AuthFields
          data={data}
          onChange={updateData}
          onValidate={(v) => setIsValidAuth(v)}
        />
      </Form>
      <Popup.Actions>
        <Popup.Confirm
          form={id}
          type="submit"
          isDisabled={isDisabled}
        />
        <Popup.Cancel onClick={onCancel} isDisabled={isLoading} />
      </Popup.Actions>
    </Popup>
  );
}
