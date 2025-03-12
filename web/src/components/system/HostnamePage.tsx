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
  Content,
  Form,
  FormGroup,
  HelperText,
  HelperTextItem,
  TextInput,
} from "@patternfly/react-core";
import { Page } from "~/components/core";
import { useProduct, useRegistration } from "~/queries/software";
import { isEmpty } from "~/utils";
import { _ } from "~/i18n";

export default function HostnamePage() {
  const { selectedProduct: product } = useProduct();
  const registration = useRegistration();
  const [error, setError] = useState<string | null>(null);
  const [hostname, setHostname] = useState<string>("");

  const submit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    if (isEmpty(hostname)) {
      setError(_("Please provide a hostname"));
      return;
    }

    const data = { hostname };

    console.log("TODO: perform the hostname update request with", data);
  };

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Hostname settings")}</Content>
      </Page.Header>

      <Page.Content>
        {product.registration && !isEmpty(registration.key) && (
          <Alert title={_("Product is already registered")} isPlain>
            {_("Updating hostname now will not take effect on registered value.")}
          </Alert>
        )}
        <Form id="hostnameForm" onSubmit={submit}>
          {error && <Alert variant="warning" isInline title={error} />}

          <FormGroup fieldId="hostname" label={_("Hostname")}>
            <TextInput id="hostname" value={hostname} onChange={(_, v) => setHostname(v)} />
            <HelperText>
              <HelperTextItem>{_("FIXME: a short help about hostname field")}</HelperTextItem>
            </HelperText>
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
