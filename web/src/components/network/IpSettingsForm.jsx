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

import React, { useEffect, useState } from "react";
import { HelperText, HelperTextItem, Form, FormGroup, FormSelect, FormSelectOption, TextInput } from "@patternfly/react-core";

import { useInstallerClient } from "~/context/installer";
import { AddressesDataList, DnsDataList } from "~/components/network";

const METHODS = {
  MANUAL: "manual",
  AUTO: "auto"
};

const usingDHCP = (method) => method === METHODS.AUTO;

export default function IpSettingsForm({ connection, onClose }) {
  const client = useInstallerClient();
  const [addresses, setAddresses] = useState([]);
  const [nameServers, setNameServers] = useState([]);
  const [method, setMethod] = useState("auto");
  const [gateway, setGateway] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!connection) return;

    const ipv4 = connection.ipv4;
    setAddresses(ipv4.addresses);
    setNameServers(ipv4.nameServers.map(a => ({ address: a })));
    setMethod(ipv4.method || "auto");
    setGateway(ipv4.gateway || "");
  }, [connection]);

  const isSetAsInvalid = field => Object.keys(errors).includes(field);

  const validatedAttrValue = (field) => {
    if (isSetAsInvalid(field)) return "error";

    return "default";
  };

  const cleanAddresses = (addrs) => addrs.filter(addr => addr.address !== "");

  const cleanError = (field) => {
    if (isSetAsInvalid(field)) {
      const nextErrors = { ...errors };
      delete nextErrors[field];
      setErrors(nextErrors);
    }
  };

  const changeMethod = (value) => {
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
      nextErrors.method = "At least one address must be provided for selected mode";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = e => {
    e.preventDefault();

    const sanitizedAddresses = cleanAddresses(addresses);
    const sanitizedNameServers = cleanAddresses(nameServers);

    if (!validate(sanitizedAddresses)) return;

    // TODO: deal with DNS servers
    const updatedConnection = {
      ...connection,
      ipv4: {
        addresses: sanitizedAddresses,
        method,
        gateway,
        nameServers: sanitizedNameServers.map(s => s.address)
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
        allowEmpty={usingDHCP(method)}
      />

      <FormGroup fieldId="gateway" label="Gateway">
        <TextInput
          id="gateway"
          name="gateway"
          aria-label="Gateway"
          value={gateway}
          label="Gateway"
          isDisabled={addresses?.length === 0}
          onChange={setGateway}
        />
      </FormGroup>

      <DnsDataList servers={nameServers} updateDnsServers={setNameServers} />
    </Form>
  );
}
