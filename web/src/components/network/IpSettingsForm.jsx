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
import { useLoaderData, useNavigate } from "react-router-dom";
import {
  HelperText,
  HelperTextItem,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  TextInput,
  Stack,
  FormHelperText,
} from "@patternfly/react-core";

import { useInstallerClient } from "~/context/installer";
import { Page } from "~/components/core";
import { AddressesDataList, DnsDataList } from "~/components/network";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

const METHODS = {
  MANUAL: "manual",
  AUTO: "auto",
};

const usingDHCP = (method) => method === METHODS.AUTO;

export default function IpSettingsForm() {
  const client = useInstallerClient();
  const connection = useLoaderData();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState(connection.addresses);
  const [nameservers, setNameservers] = useState(
    connection.nameservers.map((a) => {
      return { address: a };
    }),
  );
  const [method, setMethod] = useState(connection.method4);
  const [gateway, setGateway] = useState(connection.gateway4);
  const [errors, setErrors] = useState({});

  const isSetAsInvalid = (field) => Object.keys(errors).includes(field);
  const isGatewayDisabled = addresses.length === 0;

  const validatedAttrValue = (field) => {
    if (isSetAsInvalid(field)) return "error";

    return "default";
  };

  const cleanAddresses = (addrs) => addrs.filter((addr) => addr.address !== "");

  const cleanError = (field) => {
    if (isSetAsInvalid(field)) {
      const nextErrors = { ...errors };
      delete nextErrors[field];
      setErrors(nextErrors);
    }
  };

  const onMethodChange = (_, value) => {
    let nextAddresses = cleanAddresses(addresses);

    if (!usingDHCP(value) && nextAddresses.length === 0) {
      // FIXME: Use a model instead?
      nextAddresses = [{ address: "", prefix: "" }];
    }

    cleanError("method");
    setAddresses(nextAddresses);
    setMethod(value);
  };

  const validate = (sanitizedAddresses) => {
    setErrors({});

    const nextErrors = {};

    if (!usingDHCP(method) && sanitizedAddresses.length === 0) {
      // TRANSLATORS: error message
      nextErrors.method = _("At least one address must be provided for selected mode");
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const onSubmitForm = (e) => {
    e.preventDefault();

    const sanitizedAddresses = cleanAddresses(addresses);
    const sanitizedNameservers = cleanAddresses(nameservers);

    if (!validate(sanitizedAddresses)) return;

    // TODO: deal with DNS servers
    const updatedConnection = {
      ...connection,
      addresses: sanitizedAddresses,
      method4: method,
      gateway4: gateway,
      nameservers: sanitizedNameservers.map((s) => s.address),
    };

    client.network
      .updateConnection(updatedConnection)
      .then(navigate(-1))
      // TODO: better error reporting. By now, it sets an error for the whole connection.
      .catch(({ message }) => setErrors({ object: message }));
  };

  const renderError = (field) => {
    if (!isSetAsInvalid(field)) return null;

    return (
      <HelperText>
        <HelperTextItem variant="error">{errors[field]}</HelperTextItem>
      </HelperText>
    );
  };

  // TRANSLATORS: manual network configuration mode with a static IP address
  // %s is replaced by the connection name
  return (
    <>
      <Page.Header>
        <h2>{sprintf(_("Edit connection %s"), connection.id)}</h2>
      </Page.Header>
      <Page.MainContent>
        {renderError("object")}
        <Form id="editConnectionForm" onSubmit={onSubmitForm}>
          <Grid hasGutter>
            <GridItem sm={12} xl={6} rowSpan={2}>
              <Page.CardSection isFullHeight>
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
                        value={METHODS.AUTO}
                        label={_("Automatic (DHCP)")}
                      />
                      {/* TRANSLATORS: manual network configuration mode with a static IP address */}
                      <FormSelectOption key="manual" value={METHODS.MANUAL} label={_("Manual")} />
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
                            {_("Gateway can be defined only in 'Manual' mode")}
                          </HelperTextItem>
                        </HelperText>
                      </FormHelperText>
                    )}
                  </FormGroup>
                </Stack>
              </Page.CardSection>
            </GridItem>

            <GridItem sm={12} xl={6}>
              <Page.CardSection>
                <AddressesDataList
                  addresses={addresses}
                  updateAddresses={setAddresses}
                  allowEmpty={usingDHCP(method)}
                />
              </Page.CardSection>
            </GridItem>

            <GridItem sm={12} xl={6}>
              <Page.CardSection>
                <DnsDataList servers={nameservers} updateDnsServers={setNameservers} />
              </Page.CardSection>
            </GridItem>
          </Grid>
        </Form>
      </Page.MainContent>

      <Page.NextActions>
        <Page.CancelAction navigateTo={-1} />
        <Page.Action type="submit" form="editConnectionForm">
          {_("Accept")}
        </Page.Action>
      </Page.NextActions>
    </>
  );
}
