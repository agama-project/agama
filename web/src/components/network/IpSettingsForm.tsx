/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Content,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  FormSelectProps,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  Stack,
  TextInput,
} from "@patternfly/react-core";
import { Page } from "~/components/core";
import AddressesDataList from "~/components/network/AddressesDataList";
import DnsDataList from "~/components/network/DnsDataList";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { useConnection, useConnectionMutation } from "~/queries/network";
import { IPAddress, Connection, ConnectionMethod } from "~/types/network";

const usingDHCP = (method: ConnectionMethod) => method === ConnectionMethod.AUTO;

// FIXME: rename to connedtioneditpage or so?
// FIXME: improve the layout a bit.
export default function IpSettingsForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mutateAsync: updateConnection } = useConnectionMutation();
  const connection = useConnection(id);
  const [addresses, setAddresses] = useState<IPAddress[]>(connection.addresses);
  const [nameservers, setNameservers] = useState(
    connection.nameservers.map((a) => {
      return { address: a };
    }),
  );
  const [method, setMethod] = useState<ConnectionMethod>(connection.method4);
  const [gateway, setGateway] = useState<string>(connection.gateway4);
  const [fieldErrors, setFieldErrors] = useState<object>({});
  const [requestError, setRequestError] = useState<string | undefined>();

  const isSetAsInvalid = (field: string) => Object.keys(fieldErrors).includes(field);
  const isGatewayDisabled = addresses.length === 0;

  const validatedAttrValue = (field: string) => {
    return isSetAsInvalid(field) ? "error" : "default";
  };

  const cleanAddresses = (addrs: IPAddress[]) => addrs.filter((addr) => addr.address !== "");

  const cleanError = (field: string) => {
    if (isSetAsInvalid(field)) {
      const nextErrors = { ...fieldErrors };
      delete nextErrors[field];
      setFieldErrors(nextErrors);
    }
  };

  const onMethodChange: FormSelectProps["onChange"] = (_, value) => {
    let nextAddresses = cleanAddresses(addresses);

    if (!usingDHCP(ConnectionMethod[value]) && nextAddresses.length === 0) {
      nextAddresses = [{ address: "", prefix: "" }];
    }

    cleanError("method");
    setAddresses(nextAddresses);
    // FIXME: evaluate if there is a better and safer way to update the method,
    // maybe using the enum key instead of the value
    setMethod(value as ConnectionMethod);
  };

  const validate = (sanitizedAddresses: IPAddress[]) => {
    setFieldErrors({});

    const nextErrors: { method?: string } = {};
    if (!usingDHCP(method) && sanitizedAddresses.length === 0) {
      // TRANSLATORS: error message
      nextErrors.method = _("At least one address must be provided for selected mode");
    }

    setFieldErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const onSubmitForm = (e) => {
    e.preventDefault();

    const sanitizedAddresses = cleanAddresses(addresses);
    const sanitizedNameservers = cleanAddresses(nameservers);

    if (!validate(sanitizedAddresses)) return;

    // TODO: deal with DNS servers
    const updatedConnection = new Connection(connection.id, {
      ...connection,
      addresses: sanitizedAddresses,
      method4: method,
      gateway4: gateway,
      nameservers: sanitizedNameservers.map((s) => s.address),
    });

    updateConnection(updatedConnection)
      .then(() => navigate(-1))
      .catch((error) => {
        setRequestError(error.message);
      });
  };

  const renderError = (field: string) => {
    if (!isSetAsInvalid(field)) return null;

    return (
      <HelperText>
        <HelperTextItem variant="error">{fieldErrors[field]}</HelperTextItem>
      </HelperText>
    );
  };

  // TRANSLATORS: manual network configuration mode with a static IP address
  // %s is replaced by the connection name
  return (
    <Page>
      <Page.Header>
        <Content component="h2">{sprintf(_("Edit connection %s"), connection.id)}</Content>
      </Page.Header>

      <Page.Content>
        {requestError && (
          <Alert variant="warning" isInline title={_("Something went wrong")}>
            <Content component="p">{requestError}</Content>
          </Alert>
        )}

        <Form id="editConnectionForm" onSubmit={onSubmitForm}>
          <Grid hasGutter>
            <GridItem sm={12} xl={6} rowSpan={2}>
              <Page.Section>
                <Stack hasGutter>
                  <FormGroup fieldId="method" label={_("Mode")} isRequired>
                    <FormSelect
                      id="method"
                      name="method"
                      // TRANSLATORS: network connection mode (automatic via DHCP or manual with static IP)
                      aria-label={_("Mode")}
                      value={method}
                      label={_("Mode")}
                      onChange={onMethodChange}
                      validated={validatedAttrValue("method")}
                    >
                      <FormSelectOption
                        key="auto"
                        value={ConnectionMethod.AUTO}
                        label={_("Automatic (DHCP)")}
                      />
                      {/* TRANSLATORS: manual network configuration mode with a static IP address */}
                      <FormSelectOption
                        key="manual"
                        value={ConnectionMethod.MANUAL}
                        label={_("Manual")}
                      />
                    </FormSelect>
                    {renderError("method")}
                  </FormGroup>
                  <FormGroup fieldId="gateway" label="Gateway">
                    <TextInput
                      id="gateway"
                      name="gateway"
                      aria-label={_("Gateway")}
                      value={gateway}
                      // TRANSLATORS: network gateway configuration
                      label={_("Gateway")}
                      isDisabled={isGatewayDisabled}
                      onChange={(_, value) => setGateway(value)}
                    />
                    {isGatewayDisabled && (
                      <FormHelperText>
                        <HelperText>
                          <HelperTextItem variant="indeterminate">
                            {/** FIXME: check if that afirmation is true */}
                            {_("Gateway can be defined only in 'Manual' mode")}
                          </HelperTextItem>
                        </HelperText>
                      </FormHelperText>
                    )}
                  </FormGroup>
                </Stack>
              </Page.Section>
            </GridItem>

            <GridItem sm={12} xl={6}>
              <Page.Section>
                <AddressesDataList
                  addresses={addresses}
                  updateAddresses={setAddresses}
                  allowEmpty={usingDHCP(method)}
                />
              </Page.Section>
            </GridItem>

            <GridItem sm={12} xl={6}>
              <Page.Section>
                <DnsDataList servers={nameservers} updateDnsServers={setNameservers} />
              </Page.Section>
            </GridItem>
          </Grid>
        </Form>
      </Page.Content>

      <Page.Actions>
        <Page.Submit form="editConnectionForm" />
        <Page.Cancel />
      </Page.Actions>
    </Page>
  );
}
