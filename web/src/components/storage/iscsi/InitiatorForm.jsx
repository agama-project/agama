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
import { Form, FormGroup, TextInput } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { Popup } from "~/components/core";

export default function InitiatorForm({ initiator, onSubmit: onSubmitProp, onCancel }) {
  const [data, setData] = useState({ ...initiator });

  const onNameChange = (_, name) => setData({ ...data, name });

  const onSubmit = async (event) => {
    event.preventDefault();
    onSubmitProp(data);
  };

  const id = "editIscsiInitiator";
  const isDisabled = data.name === "";

  return (
    <Popup isOpen title={_("Edit iSCSI Initiator")}>
      <Form id={id} onSubmit={onSubmit}>
        <FormGroup fieldId="initiatorName" label="Name" isRequired>
          <TextInput
            id="initiatorName"
            name="name"
            // TRANSLATORS: iSCSI initiator name
            aria-label={_("Initiator name")}
            value={data.name || ""}
            // TRANSLATORS: input field for the iSCSI initiator name
            label={_("Name")}
            isRequired
            onChange={onNameChange}
          />
        </FormGroup>
      </Form>
      <Popup.Actions>
        <Popup.Confirm
          form={id}
          type="submit"
          isDisabled={isDisabled}
        />
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
