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
  Title,
  Text,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  EmptyStateSecondaryActions
} from "@patternfly/react-core";

import { useInstallerClient } from "./context/installer";

import {
  EOS_TASK_ALT as InstallationFinishedIcon,
  EOS_CHECK_CIRCLE as SectionIcon
} from "eos-icons-react";

import Center from "./Center";
import { SectionTitle } from "./layout/SectionTitle";

const Actions = ({ onRestart }) => (
  <Button isLarge variant="secondary" onClick={onRestart}>
    Restart Installation
  </Button>
);

function InstallationFinished() {
  const client = useInstallerClient();
  const onRestartAction = () => client.manager.startProbing();

  return (
    <Center>
      <SectionTitle>Installation Finished</SectionTitle>
      <EmptyState>
        <EmptyStateIcon icon={InstallationFinishedIcon} className="success-icon" />
        <Title headingLevel="h2" size="4xl">
          Congratulations!
        </Title>
        <EmptyStateBody className="pf-c-content">
          <div>
            <Text>The installation on your machine is complete.</Text>
            <Text>
              At this point you can 'Restart installation' to continue playing with D-Installer or
              manually reboot the machine to log in to the new system.
            </Text>
            <Text>Have a lot of fun! Your openSUSE Development Team.</Text>
          </div>
          <EmptyStateSecondaryActions>
            <Button component="a" href="https://www.opensuse.org" target="_blank" variant="link">
              www.opensuse.org
            </Button>
          </EmptyStateSecondaryActions>
        </EmptyStateBody>
      </EmptyState>
    </Center>
  );
}

export default InstallationFinished;
