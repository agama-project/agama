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
import { HelperText, HelperTextItem, Form, FormGroup, FormSelect, FormSelectOption, TextInput } from "@patternfly/react-core";
import { useInstallerClient } from "./context/installer";
import AddressesDataList from "./AddressesDataList";
import Popup from "./Popup";

const METHODS = {
  MANUAL: "manual",
  AUTO: "auto"
};

export default function IpSettingsForm({ connection, onClose }) {
  const client = useInstallerClient();
  const { ipv4 = {} } = connection;
  const [addresses, setAddresses] = useState(connection.addresses || []);
  const [method, setMethod] = useState(ipv4.method?.v || "auto");
  const [gateway, setGateway] = useState(ipv4.gateway?.v || "");
  const [errors, setErrors] = useState({});

  const isSetAsInvalid = field => Object.keys(errors).includes(field);

  const validatedAttrValue = (field) => {
    if (isSetAsInvalid(field)) return "error";

    return "default";
  };

  const cleanAddresses = (addrs) => addrs.filter(addr => addr.address !== "");

  const cleanError = (field) => {
    if (isSetAsInvalid(field)) {
      const { [field]: _, ...nextErrors } = errors;
      setErrors(nextErrors);
    }
  };

  const changeMethod = (value) => {
    let nextAddresses = cleanAddresses(addresses);

    if (value === METHODS.MANUAL && nextAddresses.length === 0) {
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

    if (method === METHODS.MANUAL && sanitizedAddresses.length === 0) {
      nextErrors.method = "At least one address must be provided for selected mode";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = e => {
    e.preventDefault();

    const sanitizedAddresses = cleanAddresses(addresses);

    if (!validate(sanitizedAddresses)) return;

    const updatedConnection = {
      ...connection,
      ipv4: {
        addresses: sanitizedAddresses,
        method,
        gateway
      }
    };

    client.network.updateConnection(updatedConnection);
    onClose();
  };

  const renderError = (field) => {
    if (!isSetAsInvalid(field)) return null;

    return (
      <HelperText>
        <HelperTextItem variant="error">{errors[field]}</HelperTextItem>
      </HelperText>
    );
  };

  return (
    <Popup isOpen height="medium" title={`Edit "${connection.id}" connection`}>
      {/* FIXME: use a real onSubmit callback */}
      <Form id="edit-connection" onSubmit={onSubmit}>
        <FormGroup fieldId="method" label="Mode" isRequired>
          <FormSelect
            id="method"
            name="method"
            aria-label="Mode"
            value={method}
            label="Mode"
            onChange={changeMethod}
            validated={validatedAttrValue("method")}
          >
            <FormSelectOption key="auto" value={METHODS.AUTO} label="Automatic (DHCP)" />
            <FormSelectOption key="manual" value={METHODS.MANUAL} label="Manual" />
          </FormSelect>
          {renderError("method")}
        </FormGroup>

        <AddressesDataList
          addresses={addresses}
          updateAddresses={setAddresses}
          allowEmpty={method === METHODS.AUTO}
        />

        <FormGroup fieldId="gateway" label="Gateway">
          <TextInput
            id="gateway"
            name="gateway"
            aria-label="Gateway"
            value={gateway}
            label="Gateway"
            isDisabled={method === METHODS.AUTO}
            onChange={setGateway}
          />
        </FormGroup>
      </Form>

      <Popup.Actions>
        <Popup.Confirm form="edit-connection" type="submit" />
        {/* FIXME: use a real onClick callback */}
        <Popup.Cancel onClick={onClose} />
      </Popup.Actions>
    </Popup>
  );
}
