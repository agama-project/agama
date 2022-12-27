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
  EmptyStateBody
} from "@patternfly/react-core";

import { Center, Title as SectionTitle, PageIcon, MainActions } from "@components/layout";
import { useInstallerClient } from "@context/installer";

import {
  CheckCircleIcon as InstallationFinishedIcon,
  TaskDoneIcon as SectionIcon
} from "@components/layout/icons";

function InstallationFinished() {
  const client = useInstallerClient();
  const onRebootAction = () => client.manager.rebootSystem();

  return (
    <>
      <SectionTitle>Installation Finished</SectionTitle>
      <PageIcon><SectionIcon width="32" height="32" /></PageIcon>
      <MainActions>
        <Button isLarge variant="primary" onClick={onRebootAction}>
          Reboot
        </Button>
      </MainActions>

      <Center>
        <EmptyState>
          <EmptyStateIcon icon={InstallationFinishedIcon} className="success-icon" />
          <Title headingLevel="h2" size="4xl">
            Congratulations!
          </Title>
          <EmptyStateBody className="pf-c-content">
            <div>
              <Text>The installation on your machine is complete.</Text>
              <Text>
                At this point you can 'Reboot' the machine to log in to the new system.
              </Text>
              <Text>Have a lot of fun! Your openSUSE Development Team.</Text>
            </div>
          </EmptyStateBody>
        </EmptyState>
      </Center>
    </>
  );
}

export default InstallationFinished;
