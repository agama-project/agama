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
  Label,
  Title,
} from "@patternfly/react-core";
import { AddonInfo, RegisteredAddonInfo } from "~/types/software";
import { useRegisteredAddons, useRegisterAddonMutation } from "~/queries/software";
import { mask } from "~/utils";
import { _ } from "~/i18n";
import RegistrationCodeInput from "./RegistrationCodeInput";

/**
 * Display registered status of the extension.
 *
 * @param param0
 * @returns
 */
const RegisteredExtensionStatus = ({ registrationCode }: { registrationCode: string | null }) => {
  const [showCode, setShowCode] = useState(false);

  // TRANSLATORS: %s will be replaced by the registration key.
  const [msg1, msg2] = _("The extension has been registered with key %s.").split("%s");

  // free extension or registered via RMT
  if (registrationCode === null) {
    return <span>{_("The extension was registered without any registration code.")}</span>;
  }

  return (
    <span>
      {msg1}
      <b>{showCode ? registrationCode : mask(registrationCode)}</b>
      {msg2}{" "}
      <Button variant="link" isInline onClick={() => setShowCode(!showCode)}>
        {/* TRANSLATORS: switch for displaying or hiding the registration code */}
        {showCode ? _("Hide") : _("Show")}
      </Button>
    </span>
  );
};

/**
 * Display an extension from the registration server.
 *
 * @param extension The extension to display
 * @returns React component
 */
export default function RegistrationExtension({
  extension,
  isUnique,
}: {
  extension: AddonInfo;
  isUnique: boolean;
}) {
  const { mutate: registerAddon } = useRegisterAddonMutation();
  const registeredExtensions = useRegisteredAddons();
  const [regCode, setRegCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onRegisterError = ({ response }) => {
    setError(response.data.message);
  };

  const registrationData = registeredExtensions.find(
    (e) => e.id === extension.id && (e.version === extension.version || e.version === null),
  );

  const isRegistered = !!registrationData;

  const id = `${extension.id}-${extension.version}`;
  const formId = `register-form-${id}`;
  const inputId = `input-reg-code-${id}`;
  const buttonId = `register-button-${id}`;

  const submit = async (e: React.SyntheticEvent | undefined) => {
    e?.preventDefault();
    setLoading(true);

    const data: RegisteredAddonInfo = {
      id: extension.id,
      registrationCode: regCode,
      // omit the version if only one version of the extension exists
      version: isUnique ? null : extension.version,
    };

    registerAddon(data, {
      // @ts-expect-error
      onError: onRegisterError,
      onSuccess: () => setError(null),
      onSettled: () => setLoading(false),
    });
  };

  return (
    <Content>
      {/* remove the "(BETA)" suffix, we display a Beta label instead */}
      <Title headingLevel="h4">
        {extension.label.replace(/\s*\(beta\)$/i, "")}{" "}
        {extension.release === "beta" && (
          <Label color="blue" isCompact>
            {/* TRANSLATORS: Beta version label */}
            {_("Beta")}
          </Label>
        )}
        {extension.recommended && (
          <Label color="orange" isCompact>
            {/* TRANSLATORS: Label for recommended extensions */}
            {_("Recommended")}
          </Label>
        )}
      </Title>
      <Content component="p">{extension.description}</Content>
      {error && <Alert variant="warning" isInline title={error} />}
      <Content>
        {isRegistered && (
          <RegisteredExtensionStatus registrationCode={registrationData.registrationCode} />
        )}
        {!isRegistered && extension.available && !extension.free && (
          <Form id={formId} onSubmit={submit}>
            {/* // TRANSLATORS: input field label */}
            <FormGroup fieldId={inputId} label={_("Registration code")}>
              <RegistrationCodeInput
                isDisabled={loading}
                id={inputId}
                value={regCode}
                onChange={(_, v) => setRegCode(v)}
              />
            </FormGroup>
            <ActionGroup>
              <Button id={buttonId} variant="primary" type="submit" isInline isLoading={loading}>
                {/* TRANSLATORS: button label */}
                {_("Register")}
              </Button>
            </ActionGroup>
          </Form>
        )}
        {!isRegistered && extension.available && extension.free && (
          // for free extensions display just the button without any form
          <Button
            id={`register-button-${extension.id}-${extension.version}`}
            variant="primary"
            isInline
            isLoading={loading}
            onClick={submit}
          >
            {/* TRANSLATORS: button label */}
            {_("Register")}
          </Button>
        )}

        {!isRegistered && !extension.available && (
          // TRANSLATORS: warning title, the extension is not available on the server and cannot be registered
          <Alert title={_("Not available")} variant="warning">
            {_(
              // TRANSLATORS: warning message, the extension is not available on the server and cannot be registered
              "This extension is not available on the server. Ask the server administrator to mirror the extension.",
            )}
          </Alert>
        )}
      </Content>
    </Content>
  );
}
