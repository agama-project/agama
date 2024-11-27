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
import { FileUpload, Flex, Form, FormGroup, Grid, GridItem } from "@patternfly/react-core";
import { Page, PasswordInput } from "~/components/core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { _ } from "~/i18n";

function RootAuthMethodsPage() {
  const passwordRef = useRef();
  const [password, setPassword] = useState("");
  const [sshKey, setSSHKey] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const startUploading = () => setIsUploading(true);
  const stopUploading = () => setIsUploading(false);
  const clearKey = () => setSSHKey("");

  const accept = (e) => {
    e.preventDefault();
    console.log("TODO: perform a check and submit if at least one method has been provided");
  };

  return (
    <Page>
      <Page.Content>
        <Grid>
          <GridItem>
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
                  <FormGroup fieldId="rootPassword" label={_("Password")} className="autoWidth">
                    <PasswordInput
                      inputRef={passwordRef}
                      id="rootPassword"
                      value={password}
                      className="autoInlineSize"
                      onChange={(_, value) => setPassword(value)}
                    />
                  </FormGroup>
                  <FormGroup fieldId="sshKey" label={_("SSH public key")}>
                    <FileUpload
                      id="sshKey"
                      value={sshKey}
                      type="text"
                      filenamePlaceholder={_("Upload, paste, or drop here an SSH public key")}
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
                  </FormGroup>
                </Flex>
              </Form>
            </Page.Section>
          </GridItem>
        </Grid>
      </Page.Content>
      <Page.Actions>
        <Page.Submit form="rootAuthMethods" onClick={accept} />
      </Page.Actions>
    </Page>
  );
}

export default RootAuthMethodsPage;
