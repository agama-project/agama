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
  Form, FormGroup, FormSelect, FormSelectOption
} from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
import { Popup } from "~/components/core";
import { NodeStartupOptions } from "~/components/storage/iscsi";

export default function EditNodeForm({ node, onSubmit: onSubmitProp, onCancel }) {
  const [data, setData] = useState({ startup: node.startup });

  const onStartupChange = (_, v) => setData({ ...data, startup: v });

  const onSubmit = async (event) => {
    event.preventDefault();
    await onSubmitProp(data);
  };

  const startupFormOptions = Object.values(NodeStartupOptions).map((option, i) => (
    <FormSelectOption key={i} value={option.value} label={option.label} />
  ));

  const id = "iscsiEditNode";

  return (
    // TRANSLATORS: %s is replaced by the iSCSI target node name
    <Popup isOpen title={sprintf(_("Edit %s"), node.target)}>
      <Form id={id} onSubmit={onSubmit}>
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
      </Form>
      <Popup.Actions>
        <Popup.Confirm
          form={id}
          type="submit"
        />
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
