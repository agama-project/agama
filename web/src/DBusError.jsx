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

import React from "react";
import {
  Button,
  Bullseye,
  Title,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody
} from "@patternfly/react-core";

import Layout from "./Layout";

import {
  EOS_ANNOUNCEMENT as SectionIcon,
  EOS_ENDPOINTS_DISCONNECTED as DisconnectionIcon
} from "eos-icons-react";

// TODO: an example
const ReloadAction = () => (
  <Button isLarge isPrimary>
    Reload
  </Button>
);

function DBusError() {
  return (
    <Layout sectionTitle="DBus Error" SectionIcon={SectionIcon} FooterActions={ReloadAction}>
      <Bullseye className="layout__content-child--filling-block-size">
        <EmptyState>
          <EmptyStateIcon icon={DisconnectionIcon} />
          <Title headingLevel="h4" size="lg">
            Cannot connect to DBus
          </Title>
          <EmptyStateBody>
            D-Installer UI cannot connect with D-Installer DBus service. Please check if it is
            running.
          </EmptyStateBody>
        </EmptyState>
      </Bullseye>
    </Layout>
  );
}

export default DBusError;
