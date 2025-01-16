/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { Bullseye, Flex, Form, FormGroup } from "@patternfly/react-core";
import { useLocation, useNavigate } from "react-router-dom";
import { Page, PasswordInput } from "~/components/core";
import { useRootUserMutation } from "~/queries/users";
import { ROOT as PATHS } from "~/routes/paths";
import { isEmpty } from "~/utils";
import { _ } from "~/i18n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import sizingStyles from "@patternfly/react-styles/css/utilities/Sizing/sizing";

/**
 * A page component for setting at least one root authentication method
 *
 * NOTE: This page will be automatically displayed only when no root authentication
 * method is set. It is not within the scope of this component to fill data if
 * users manually enter the route path.
 */
function RootAuthMethodsPage() {
  const passwordRef = useRef();
  const navigate = useNavigate();
  const location = useLocation();
  const setRootUser = useRootUserMutation();
  const [password, setPassword] = useState("");

  const isFormValid = !isEmpty(password);

  const accept = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (isEmpty(password)) return;

    await setRootUser.mutateAsync({ password, hashedPassword: false });

    navigate(location.state?.from || PATHS.root, { replace: true });
  };

  return (
    <Page>
      <Page.Content>
        <Bullseye>
          <Page.Section
            headerLevel="h2"
            title={_("Setup root user authentication")}
            description={
              <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
                <p className={textStyles.fontSizeLg}>
                  {_("Provide a password to ensure administrative access to the system.")}
                </p>
                <p className={textStyles.fontSizeMd}>
                  {_(
                    "You can change it or select another authentication method in the 'Users' section before installing.",
                  )}
                </p>
              </Flex>
            }
            pfCardProps={{ isCompact: false, isFullHeight: false }}
            pfCardBodyProps={{ isFilled: true }}
          >
            <Form id="rootAuthMethods" onSubmit={accept}>
              <FormGroup fieldId="rootPassword" label={_("Password for root user")}>
                <PasswordInput
                  inputRef={passwordRef}
                  id="rootPassword"
                  value={password}
                  className={sizingStyles.w_50OnMd}
                  onChange={(_, value) => setPassword(value)}
                />
              </FormGroup>
            </Form>
          </Page.Section>
        </Bullseye>
      </Page.Content>
      <Page.Actions>
        <Page.Submit form="rootAuthMethods" isDisabled={!isFormValid} onClick={accept} />
      </Page.Actions>
    </Page>
  );
}

export default RootAuthMethodsPage;
