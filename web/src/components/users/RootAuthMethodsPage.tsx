/*
 * Copyright (c) [2024] SUSE LLC
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
  Button,
  FileUpload,
  Flex,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { Center } from "~/components/layout";
import { Page, PasswordInput } from "~/components/core";
import { useRootUserMutation } from "~/queries/users";
import { RootUserChanges } from "~/types/users";
import { ROOT as PATHS } from "~/routes/paths";
import { isEmpty } from "~/utils";
import { _ } from "~/i18n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import sizingStyles from "@patternfly/react-styles/css/utilities/Sizing/sizing";

function RootAuthMethodsPage() {
  const passwordRef = useRef();
  const navigate = useNavigate();
  const setRootUser = useRootUserMutation();
  const [password, setPassword] = useState("");
  const [sshKey, setSSHKey] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const startUploading = () => setIsUploading(true);
  const stopUploading = () => setIsUploading(false);
  const clearKey = () => setSSHKey("");

  const isFormValid = !isEmpty(password) || !isEmpty(sshKey);
  const uploadFile = () => document.getElementById("sshKey-browse-button").click();

  const accept = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    const data: Partial<RootUserChanges> = {};

    if (!isEmpty(password)) {
      data.password = password;
      data.encryptedPassword = false;
    }

    if (!isEmpty(sshKey)) {
      data.sshkey = sshKey;
    }

    if (isEmpty(data)) return;

    await setRootUser.mutateAsync(data);

    navigate(PATHS.root);
  };

  // TRANSLATORS: %s will be replaced by a link with the text "upload".
  const [sshKeyStartHelperText, sshKeyEndHelperText] = _(
    "Write, paste, drop, or %s a SSH public key file in the above textarea.",
  ).split("%s");

  return (
    <Page>
      <Page.Content>
        <Center>
          <Page.Section
            headerLevel="h2"
            title={_("Setup root user authentication")}
            description={
              <p className={textStyles.fontSizeXl}>
                {_(
                  "To continue with the installation settings, define at least one authentication method for the root user. You can still edit them anytime before installation.",
                )}
              </p>
            }
            pfCardProps={{ isCompact: false }}
            pfCardBodyProps={{ isFilled: true }}
          >
            <Form id="rootAuthMethods" onSubmit={accept}>
              <Flex direction={{ default: "column" }} rowGap={{ default: "rowGapXl" }}>
                <FormGroup fieldId="rootPassword" label={_("Password")}>
                  <PasswordInput
                    inputRef={passwordRef}
                    id="rootPassword"
                    value={password}
                    className={sizingStyles.wAuto}
                    onChange={(_, value) => setPassword(value)}
                  />
                </FormGroup>
                <FormGroup fieldId="sshKey" label={_("SSH public key")}>
                  <FileUpload
                    id="sshKey"
                    value={sshKey}
                    type="text"
                    aria-label={_(
                      "Write, paste, or drop an SSH public key here. You can also upload it by using the link below.",
                    )}
                    // TRANSLATORS: push button label
                    browseButtonText={_("Upload")}
                    // TRANSLATORS: push button label, clears the related input field
                    clearButtonText={_("Clear")}
                    isLoading={isUploading}
                    onDataChange={(_, value) => setSSHKey(value)}
                    onTextChange={(_, value) => setSSHKey(value)}
                    onReadStarted={startUploading}
                    onReadFinished={stopUploading}
                    onClearClick={clearKey}
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem variant="indeterminate">
                        {sshKeyStartHelperText}
                        <Button variant="link" isInline onClick={uploadFile}>
                          {_("upload")}
                        </Button>
                        {sshKeyEndHelperText}
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
              </Flex>
            </Form>
          </Page.Section>
        </Center>
      </Page.Content>
      <Page.Actions>
        <Page.Submit form="rootAuthMethods" isDisabled={!isFormValid} onClick={accept} />
      </Page.Actions>
    </Page>
  );
}

export default RootAuthMethodsPage;
