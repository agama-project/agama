/*
 * Copyright (c) [2026] SUSE LLC
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
import { useNavigate } from "react-router";
import { Alert, Button, Form, FormGroup, TextInput, ActionGroup } from "@patternfly/react-core";
import { Page } from "~/components/core";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";
import { useSystem } from "~/hooks/model/system/iscsi";
import { useSetInitiator } from "~/hooks/model/config/iscsi";

export default function InitiatorFormPage() {
  const initiator = useSystem().initiator;
  const [data, setData] = useState({ ...initiator });
  const [error, setError] = useState<string | null>(null);
  const setInitiator = useSetInitiator();
  const navigate = useNavigate();

  const onNameChange = (_, name) => setData({ ...data, name });

  const submit = async () => {
    setError(null);
    setInitiator(data.name);
    navigate({ pathname: STORAGE.iscsi.root });
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (data.name !== "") return submit();

    setError(_("The initiator name cannot be blank"));
  };

  return (
    <Page
      breadcrumbs={[
        { label: _("Storage"), path: STORAGE.root },
        { label: _("iSCSI"), path: STORAGE.iscsi.root },
        { label: _("Initiator") },
      ]}
    >
      <Page.Content>
        <Form onSubmit={onSubmit}>
          {error && <Alert variant="warning" isInline title={error} />}
          <FormGroup label={_("Name")}>
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
          </FormGroup>
          <ActionGroup>
            <Button type="submit">{_("Change")}</Button>
            <Page.Back>{_("Cancel")}</Page.Back>
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
