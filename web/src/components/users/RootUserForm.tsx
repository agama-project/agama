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

import React, { useRef, useState } from "react";
import {
  ActionGroup,
  Alert,
  Button,
  Checkbox,
  Content,
  FileUpload,
  Form,
  FormGroup,
} from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { NestedContent, Page, PasswordAndConfirmationInput } from "~/components/core";
import { useRootUser, useRootUserMutation } from "~/queries/users";
import { RootUser } from "~/types/users";
import { isEmpty } from "radashi";
import { _ } from "~/i18n";
import PasswordCheck from "~/components/users/PasswordCheck";

const AVAILABLE_METHODS = ["password", "sshPublicKey"] as const;
type ActiveMethods = { [key in (typeof AVAILABLE_METHODS)[number]]?: boolean };

const initialState = (user: RootUser): ActiveMethods =>
  AVAILABLE_METHODS.reduce((result, key) => {
    return { ...result, [key]: !isEmpty(user[key]) };
  }, {});

const SSHKeyField = ({ value, onChange }) => {
  const [isUploading, setIsUploading] = useState(false);

  const startUploading = () => setIsUploading(true);
  const stopUploading = () => setIsUploading(false);
  const clearKey = () => onChange("");

  return (
    <FileUpload
      id="sshkey"
      type="text"
      value={value}
      filenamePlaceholder={_("Upload, paste, or drop an SSH public key")}
      // TRANSLATORS: push button label
      browseButtonText={_("Upload")}
      // TRANSLATORS: push button label, clears the related input field
      clearButtonText={_("Clear")}
      isLoading={isUploading}
      onDataChange={(_, value) => onChange(value)}
      onTextChange={(_, value) => onChange(value)}
      onReadStarted={startUploading}
      onReadFinished={stopUploading}
      onClearClick={clearKey}
    />
  );
};

const RootUserForm = () => {
  const navigate = useNavigate();
  const rootUser = useRootUser();
  const { mutateAsync: updateRootUser } = useRootUserMutation();
  const [activeMethods, setActiveMethods] = useState(initialState(rootUser));
  const [errors, setErrors] = useState([]);
  const [usingHashedPassword, setUsingHashedPassword] = useState(
    rootUser ? rootUser.hashedPassword : false,
  );
  const [password, setPassword] = useState(usingHashedPassword ? "" : rootUser?.password);
  const [sshkey, setSshKey] = useState(rootUser?.sshPublicKey);
  const passwordRef = useRef<HTMLInputElement>();

  const onPasswordChange = (_, value: string) => setPassword(value);
  const toggleMethod = (method: keyof ActiveMethods) => {
    const nextMethodsState = { ...activeMethods, [method]: !activeMethods[method] };
    setActiveMethods(nextMethodsState);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const nextErrors = [];
    setErrors([]);

    const passwordInput = passwordRef.current;

    if (activeMethods.password && !usingHashedPassword) {
      isEmpty(password) && nextErrors.push(_("Password is empty."));
      !passwordInput?.validity.valid && nextErrors.push(passwordInput?.validationMessage);
    }

    if (activeMethods.sshPublicKey && isEmpty(sshkey)) {
      nextErrors.push(_("Public SSH Key is empty."));
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    const data: Partial<RootUser> = {
      sshPublicKey: activeMethods.sshPublicKey ? sshkey : "",
    };

    if (!activeMethods.password) {
      data.password = "";
      data.hashedPassword = false;
    }

    if (activeMethods.password) {
      data.password = usingHashedPassword ? rootUser.password : password;
      data.hashedPassword = usingHashedPassword;
    }

    updateRootUser(data)
      .then(() => navigate(".."))
      .catch((e) => setErrors([e.response.data]));
  };
  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Root authentication methods")}</Content>
      </Page.Header>

      <Page.Content>
        <Form id="rootAuthMethods" onSubmit={onSubmit} isWidthLimited maxWidth="fit-content">
          {errors.length > 0 && (
            <Alert variant="warning" isInline title={_("Something went wrong")}>
              {errors.map((e, i) => (
                <p key={`error_${i}`}>{e}</p>
              ))}
            </Alert>
          )}
          <FormGroup>
            <Checkbox
              id="setPassword"
              label={_("Use password")}
              isChecked={activeMethods.password}
              onChange={() => toggleMethod("password")}
            />
          </FormGroup>
          {activeMethods.password && (
            <NestedContent margin="mxLg">
              {usingHashedPassword ? (
                <Content isEditorial>
                  {_("Using a hashed password.")}{" "}
                  <Button variant="link" isInline onClick={() => setUsingHashedPassword(false)}>
                    {_("Change")}
                  </Button>
                </Content>
              ) : (
                <>
                  <PasswordAndConfirmationInput
                    inputRef={passwordRef}
                    value={password}
                    onChange={onPasswordChange}
                    showErrors={false}
                  />
                  <PasswordCheck password={password} />
                </>
              )}
            </NestedContent>
          )}

          <FormGroup>
            <Checkbox
              id="setSSHKey"
              label={_("Use public SSH Key")}
              isChecked={activeMethods.sshPublicKey}
              onChange={() => toggleMethod("sshPublicKey")}
            />
          </FormGroup>
          <FormGroup>
            {activeMethods.sshPublicKey && (
              <NestedContent margin="mxLg">
                <SSHKeyField value={sshkey} onChange={setSshKey} />
              </NestedContent>
            )}
          </FormGroup>

          <ActionGroup>
            <Page.Submit form="rootAuthMethods" />
            <Page.Cancel />
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
};

export default RootUserForm;
