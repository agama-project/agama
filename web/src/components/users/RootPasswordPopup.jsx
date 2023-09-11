/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { Form } from "@patternfly/react-core";
import { PasswordAndConfirmationInput, Popup } from '~/components/core';

import { _ } from "~/i18n";
import { useInstallerClient } from "~/context/installer";

/**
 * A dialog holding the form to change the root password
 * @component
 *
 * @example <caption>Simple usage</caption>
 *   <RootPasswordPopup isOpen={isRootPasswordFormOpen} onClose={() => onCloseCallback()} />
 *
 * @param {object} props
 * @param {string} [props.title="Root password"] - the text to be used as the title of the dialog
 * @param {boolean} props.isOpen - whether the dialog should be visible
 * @param {function} props.onClose - the function to be called when the dialog is closed
 */
export default function RootPasswordPopup({
  title = _("Root password"),
  isOpen,
  onClose
}) {
  const { users: client } = useInstallerClient();
  const [password, setPassword] = useState("");
  const [isValidPassword, setIsValidPassword] = useState(true);

  const close = () => {
    setPassword("");
    onClose();
  };

  const accept = async (e) => {
    e.preventDefault();
    // TODO: handle errors
    if (password !== "") await client.setRootPassword(password);
    close();
  };

  const onPasswordChange = (_, value) => setPassword(value);

  const onPasswordValidation = (isValid) => setIsValidPassword(isValid);

  return (
    <Popup title={title} isOpen={isOpen}>
      <Form id="root-password" onSubmit={accept}>
        <PasswordAndConfirmationInput
          value={password}
          onChange={onPasswordChange}
          onValidation={onPasswordValidation}
        />
      </Form>

      <Popup.Actions>
        <Popup.Confirm form="root-password" type="submit" isDisabled={password === "" || !isValidPassword} />
        <Popup.Cancel onClick={close} />
      </Popup.Actions>
    </Popup>
  );
}
