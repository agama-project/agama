/*
 * Copyright (c) [2025] SUSE LLC
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
import {
  ActionGroup,
  Alert,
  Button,
  Checkbox,
  Content,
  Form,
  FormGroup,
  TextInput,
} from "@patternfly/react-core";
import { Page } from "~/components/core";
import { isEmpty } from "~/utils";
import { _ } from "~/i18n";

export default function HostnamePage() {
  const [error, setError] = useState<string | null>(null);
  const [hostname, setHostname] = useState<string>("");
  const [enableDHCP, setEnableDHCP] = useState<boolean>(false);

  const submit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    if (isEmpty(hostname)) {
      setError(_("Please provide a hostname"));
      return;
    }

    const data = { hostname, allowDHCP: enableDHCP };

    console.log("TODO: perform the hostname update request with", data);
  };

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Hostname settings")}</Content>
      </Page.Header>

      <Page.Content>
        <Form id="hostnameForm" onSubmit={submit}>
          {error && <Alert variant="warning" isInline title={error} />}

          <FormGroup fieldId="hostname" label={_("Hostname")}>
            <TextInput id="hostname" value={hostname} onChange={(_, v) => setHostname(v)} />
          </FormGroup>

          <FormGroup>
            <Checkbox
              id="enableDHCP"
              label={_("Enable DHCP hostname assignment")}
              description={_(
                "Allows the system to use the hostname set manually, but DHCP may modify it if the network provides a different one.",
              )}
              isChecked={enableDHCP}
              onChange={() => setEnableDHCP(!enableDHCP)}
            />
          </FormGroup>

          <ActionGroup>
            <Button variant="primary" type="submit">
              {_("Accept")}
            </Button>
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
