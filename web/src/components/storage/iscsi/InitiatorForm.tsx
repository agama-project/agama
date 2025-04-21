/*
 * Copyright (c) [2023-2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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
import { Alert, Button, Form, FormGroup, TextInput, Split, Spinner } from "@patternfly/react-core";

import { _ } from "~/i18n";

export default function InitiatorForm({ initiator, onSubmit: onSubmitProp }) {
  const [data, setData] = useState({ ...initiator });
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const onNameChange = (_, name) => setData({ ...data, name });

  const submit = async () => {
    setUpdating(true);
    setSuccess(null);
    setError(null);
    onSubmitProp(data)
      .then(() => {
        setSuccess(_("Initiator name successfully updated"));
        setUpdating(false);
      })
      .catch(() => {
        setError(_("Initiator name could not be updated"));
        setUpdating(false);
      });
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (data.name !== "") return submit();

    setSuccess(null);
    setError(_("The initiator name cannot be blank"));
  };

  const id = "editIscsiInitiator";

  if (updating)
    return (
      <Alert
        isPlain
        customIcon={<Spinner size="md" aria-hidden />}
        title={_("Updating the initiator name")}
      />
    );

  return (
    <Form id={id} onSubmit={onSubmit}>
      {success && <Alert variant="success" isInline title={success} />}
      {error && <Alert variant="warning" isInline title={error} />}
      <FormGroup label={_("Name")}>
        <Split hasGutter>
          <TextInput
            id="initiatorName"
            name="name"
            size={50}
            // TRANSLATORS: iSCSI initiator name
            aria-label={_("Initiator name")}
            value={data.name || ""}
            // TRANSLATORS: input field for the iSCSI initiator name
            label={_("Name")}
            onChange={onNameChange}
          />
          <Button type="submit" variant="secondary">
            {_("Change")}
          </Button>
        </Split>
      </FormGroup>
    </Form>
  );
}
