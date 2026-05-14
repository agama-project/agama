/*
 * Copyright (c) [2024-2026] SUSE LLC
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

import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { ActionGroup, Alert, Checkbox, Form } from "@patternfly/react-core";
import { NestedContent, Page, PasswordAndConfirmationInput } from "~/components/core";
import PasswordCheck from "~/components/users/PasswordCheck";
import {
  useConfigModel,
  useSetEncryption,
  useIsTpmAvailable,
} from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { isEmpty } from "radashi";
import { _, N_ } from "~/i18n";
import { STORAGE } from "~/routes/paths";
import bootloaderSystem from "~/model/system/bootloader";
import type { ConfigModel } from "~/model/storage/config-model";

const TPM_EXPLANATION = N_(
  "The password will not be needed to boot and access the data if the TPM can verify the \
integrity of the system.",
);

// TRANSLATORS: The word 'directly' is key here. For example, booting to the installer media and
// then choosing 'Boot from Hard Disk' from there will not work. Keep it sort (this is a hint in a
// form) but keep it clear.
const TPM_FDE_INSTRUCTIONS = N_(
  "TPM sealing requires the new system to be booted directly on its first run.",
);

const generateTpmDescription = (config: ConfigModel.Config | null): string => {
  const bootloaderType = config ? configModel.getBootloader(config) : null;

  return bootloaderType && bootloaderSystem.isBls(bootloaderType)
    ? _(TPM_EXPLANATION)
    : [_(TPM_EXPLANATION), _(TPM_FDE_INSTRUCTIONS)].join(" ");
};

/**
 * Renders a form that allows the user change encryption settings
 */
export default function EncryptionSettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const config = useConfigModel();
  const setEncryption = useSetEncryption();
  const isTpmAvailable = useIsTpmAvailable();

  const [errors, setErrors] = useState([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [tpm, setTpm] = useState(false);
  const [password, setPassword] = useState("");

  const passwordRef = useRef<HTMLInputElement>();
  const formId = "encryptionSettingsForm";

  useEffect(() => {
    if (config?.encryption) {
      setIsEnabled(true);
      setTpm(config.encryption.tpm || false);
      setPassword(config.encryption.password || "");
    }
  }, [config]);

  const changePassword = (_, v: string) => setPassword(v);

  const changeTpm = (_, useTpm: boolean) => setTpm(useTpm);

  const onSubmit = (e) => {
    e.preventDefault();

    const nextErrors = [];
    setErrors([]);

    const passwordInput = passwordRef.current;

    if (isEnabled) {
      isEmpty(password) && nextErrors.push(_("Password is empty."));
      !passwordInput?.validity.valid && nextErrors.push(passwordInput?.validationMessage);
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    const commit = () => (isEnabled ? setEncryption({ password, tpm }) : setEncryption(null));

    commit();
    navigate({ pathname: "..", search: location.search });
  };

  // TRANSLATORS: "Trusted Platform Module" is the name of the technology and TPM its abbreviation
  const tpmLabel = _("Use the Trusted Platform Module (TPM) to decrypt automatically on each boot");
  const tpmDescription = generateTpmDescription(config);

  return (
    <Page
      breadcrumbs={[
        { label: _("Storage"), path: STORAGE.root },
        { label: _("Encryption settings") },
      ]}
    >
      <Page.Content>
        <Form id={formId} onSubmit={onSubmit}>
          {errors.length > 0 && (
            <Alert variant="warning" isInline title={_("Something went wrong")}>
              {errors.map((e, i) => (
                <p key={`error_${i}`}>{e}</p>
              ))}
            </Alert>
          )}
          <Checkbox
            id="encryption"
            label={_("Encrypt the system")}
            description={_(
              "Full Disk Encryption (FDE) allows to protect the information stored \
at the new file systems, including data, programs, and system files.",
            )}
            isChecked={isEnabled}
            onChange={() => setIsEnabled(!isEnabled)}
          />
          {isEnabled && (
            <NestedContent margin="mxLg">
              <PasswordAndConfirmationInput
                inputRef={passwordRef}
                initialValue={config?.encryption?.password}
                value={password}
                onChange={changePassword}
                isDisabled={!isEnabled}
                showErrors={false}
              />
              <PasswordCheck password={password} />
              {isTpmAvailable && (
                <Checkbox
                  id="tpm"
                  label={tpmLabel}
                  description={tpmDescription}
                  isChecked={tpm}
                  onChange={changeTpm}
                />
              )}
            </NestedContent>
          )}
          <ActionGroup>
            <Page.Submit form={formId} />
            <Page.Cancel />
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
