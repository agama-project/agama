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

import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Form, FormGroup,
  TextInput,
} from "@patternfly/react-core";

import { FormValidationError, Popup } from "~/components/core";
import { AuthFields } from "~/components/storage/iscsi";
import { useLocalStorage } from "~/utils";
import { isValidIp } from "~/client/network/utils";
import { _ } from "~/i18n";

const defaultData = {
  address: "",
  port: "3260",
  username: "",
  password: "",
  reverseUsername: "",
  reversePassword: ""
};

export default function DiscoverForm({ onSubmit: onSubmitProp, onCancel }) {
  const [savedData, setSavedData] = useLocalStorage("agama-iscsi-discovery", defaultData);
  const [data, setData] = useState(defaultData);
  const [isLoading, setIsLoading] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isValidAuth, setIsValidAuth] = useState(true);
  const alertRef = useRef(null);

  useEffect(() => {
    setData(savedData);
  }, [setData, savedData]);

  useEffect(() => {
    // Scroll the alert into view
    if (isFailed)
      alertRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  });

  const updateData = (key, value) => setData({ ...data, [key]: value });
  const onAddressChange = (_, v) => updateData("address", v);
  const onPortChange = (_, v) => updateData("port", v);

  const onSubmit = async (event) => {
    event.preventDefault();

    setIsLoading(true);
    setSavedData(data);

    const result = await onSubmitProp(data);

    if (result !== 0) {
      setIsFailed(true);
      setIsLoading(false);
    }
  };

  const isValidAddress = () => isValidIp(data.address);
  const isValidPort = () => Number.isInteger(parseInt(data.port));
  const isValidForm = () => {
    return (
      isValidAddress() &&
      isValidPort() &&
      isValidAuth
    );
  };

  const showAddressError = () => data.address.length > 0 && !isValidAddress(data.address);
  const showPortError = () => data.port.length > 0 && !isValidPort(data.port);

  const id = "iscsiDiscover";
  const isDisabled = isLoading || !isValidForm();

  return (
    // TRANSLATORS: popup title
    <Popup isOpen title={_("Discover iSCSI Targets")}>
      <Form id={id} onSubmit={onSubmit}>
        { isFailed &&
          <div ref={alertRef}>
            <Alert
              variant="warning"
              isInline
              title={_("Something went wrong")}
            >
              <p>{_("Make sure you provide the correct values")}</p>
            </Alert>
          </div> }
        <FormGroup
          fieldId="address"
          label={_("IP address")}
          isRequired
        >
          <TextInput
            id="address"
            name="address"
            // TRANSLATORS: network address
            aria-label={_("Address")}
            value={data.address || ""}
            label={_("Address")}
            isRequired
            onChange={onAddressChange}
            validated={showAddressError() ? "error" : "default"}
          />
          <FormValidationError message={showAddressError() ? _("Incorrect IP address") : "" } />
        </FormGroup>
        <FormGroup
          fieldId="port"
          label={_("Port")}
          isRequired
        >
          <TextInput
            id="port"
            name="port"
            // TRANSLATORS: network port number
            aria-label={_("Port")}
            value={data.port || ""}
            label={_("Port")}
            isRequired
            onChange={onPortChange}
            validated={showPortError() ? "error" : "default"}
          />
          <FormValidationError message={showPortError() ? _("Incorrect port") : "" } />
        </FormGroup>
        <AuthFields
          data={data}
          onChange={updateData}
          onValidate={(v) => setIsValidAuth(v)}
        />
      </Form>
      <Popup.Actions>
        <Popup.Confirm
          form={id}
          type="submit"
          isDisabled={isDisabled}
        />
        <Popup.Cancel onClick={onCancel} isDisabled={isLoading} />
      </Popup.Actions>
    </Popup>
  );
}
