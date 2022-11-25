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

import React, { useReducer } from "react";

import {
  Form,
  FormGroup,
  Switch,
  TextInput
} from "@patternfly/react-core";

import { Fieldset } from "@components/core";

const reducer = (state, action) => {
  switch (action.type) {
    case "LVM_CHANGE" : {
      return { ...state, lvm: action.payload.lvm };
    }

    case "ENCRYPTION_CHANGE": {
      return { ...state, encryption: action.payload.encryption };
    }

    case "PASSWORD_CHANGE": {
      return { ...state, encryptionPassword: action.payload.encryptionPassword };
    }

    default: {
      return state;
    }
  }
};

export default function ProposalSettingsForm({ id, proposal, onSubmit }) {
  const [state, dispatch] = useReducer(reducer, {
    lvm: proposal.lvm,
    encryption: proposal.encryptionPassword.length !== 0,
    encryptionPassword: proposal.encryptionPassword
  });

  const onLvmChange = (value) => {
    dispatch({ type: "LVM_CHANGE", payload: { lvm: value } });
  };

  const onEncryptionChange = (value) => {
    dispatch({ type: "ENCRYPTION_CHANGE", payload: { encryption: value } });
  };

  const onPasswordChange = (value) => {
    dispatch({ type: "PASSWORD_CHANGE", payload: { encryptionPassword: value } });
  };

  const accept = (e) => {
    e.preventDefault();

    const lvm = state.lvm;
    const encryptionPassword = state.encryption ? state.encryptionPassword : "";

    onSubmit({ lvm, encryptionPassword });
  };

  return (
    <Form id={id} onSubmit={accept}>
      <Switch
        id="lvm"
        label="Use LVM"
        isReversed
        isChecked={state.lvm}
        onChange={onLvmChange}
      />
      <Fieldset
        legend={
          <Switch
            id="encryption"
            label="Encrypt devices"
            isReversed
            isChecked={state.encryption}
            onChange={onEncryptionChange}
          />
        }
      >
        <FormGroup fieldId="encryptionPassword" label="Encryption password">
          <TextInput
            id="encryptionPassword"
            type="password"
            isDisabled={!state.encryption}
            aria-label="password"
            value={state.encryptionPassword}
            onChange={onPasswordChange}
          />
        </FormGroup>
      </Fieldset>
    </Form>
  );
}
