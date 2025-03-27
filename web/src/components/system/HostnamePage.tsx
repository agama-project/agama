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

import React, { useState, SyntheticEvent } from "react";
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
import { NestedContent, Page } from "~/components/core";
import { useProduct, useRegistration } from "~/queries/software";
import { useHostname, useHostnameMutation } from "~/queries/system";
import { isEmpty } from "~/utils";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

export default function HostnamePage() {
  const registration = useRegistration();
  const { selectedProduct: product } = useProduct();
  const { transient: transientHostname, static: staticHostname } = useHostname();
  const { mutateAsync: updateHostname } = useHostnameMutation();
  const hasTransientHostname = isEmpty(staticHostname);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingHostname, setSettingHostname] = useState(!hasTransientHostname);
  const [hostname, setHostname] = useState(staticHostname);

  const toggleSettingHostname = () => setSettingHostname(!settingHostname);
  const onHostnameChange = (_: SyntheticEvent, v: string) => setHostname(v);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (settingHostname && isEmpty(hostname)) {
      setError(_("Enter a hostname."));
      return;
    }

    updateHostname({ static: settingHostname ? hostname : "" })
      .then(() => setSuccess("Hostname successfully updated."))
      .catch(() =>
        setError("Something went wrong while updating the hostname. Please, try again."),
      );
  };

  // TRANSLATORS: The title for a notification shown when the static hostname
  // has not been set. "transient" refers to the hostname mode, and %s will be
  // replaced with the current hostname value.
  const transientHostnameAlertTitle = sprintf(_("Using transient hostname: %s"), transientHostname);

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Hostname")}</Content>
      </Page.Header>

      <Page.Content>
        {product.registration && !isEmpty(registration.key) && (
          <Alert title={_("Product is already registered")} variant="info">
            {_(
              "Updating the hostname now or later will not change the currently registered hostname.",
            )}
          </Alert>
        )}

        {hasTransientHostname && (
          <Alert variant="custom" title={transientHostnameAlertTitle}>
            {_(
              "This hostname is dynamic and may change after a reboot or network update, as configured by the local network administrator.",
            )}
          </Alert>
        )}

        <Form id="hostnameForm" onSubmit={submit}>
          {success && <Alert variant="success" isInline title={success} />}
          {error && (
            <Alert variant="warning" isInline title={_("Check the following before continuing")}>
              {error}
            </Alert>
          )}
          <FormGroup fieldId="settingHostname">
            <Checkbox
              id="hostname"
              label={_("Use static hostname")}
              description={_("Set a permanent hostname that won’t change with network updates.")}
              isChecked={settingHostname}
              onChange={toggleSettingHostname}
            />
          </FormGroup>
          {settingHostname && (
            <FormGroup fieldId="hostname">
              <NestedContent>
                <TextInput
                  id="hostname"
                  aria-label={_("Static hostname")}
                  value={hostname}
                  onChange={onHostnameChange}
                />
              </NestedContent>
            </FormGroup>
          )}

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
