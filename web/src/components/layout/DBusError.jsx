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
import { Button, Title, EmptyState, EmptyStateIcon, EmptyStateBody } from "@patternfly/react-core";

import {
  Icon,
  Center,
  MainActions,
  PageIcon,
  Title as PageTitle,
} from "@components/layout";

// TODO: an example
const ReloadAction = () => (
  <Button isLarge variant="primary" onClick={() => location.reload()}>
    Reload
  </Button>
);

function DBusError() {
  return (
    <>
      <PageTitle>D-Bus Error</PageTitle>
      <PageIcon><Icon name="problem" /></PageIcon>
      <MainActions><ReloadAction /></MainActions>

      <Center>
        <EmptyState>
          <EmptyStateIcon icon={({ ...props }) => <Icon name="error" { ...props } />} />
          <Title headingLevel="h2" size="4xl">
            Cannot connect to D-Bus
          </Title>
          <EmptyStateBody>
            Could not connect to the D-Bus service. Please, check whether it is running.
          </EmptyStateBody>
        </EmptyState>
      </Center>
    </>
  );
}

export default DBusError;
