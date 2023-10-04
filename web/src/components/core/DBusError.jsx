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
import { Button, EmptyState, EmptyStateIcon, EmptyStateBody, EmptyStateHeader } from "@patternfly/react-core";
import { _ } from "~/i18n";

import {
  Center,
  Icon,
  MainActions,
  PageIcon,
  Title as PageTitle,
} from "~/components/layout";

const ErrorIcon = () => <Icon name="error" className="icon-big" />;

// TODO: an example
const ReloadAction = () => (
  <Button size="lg" variant="primary" onClick={() => location.reload()}>
    {/* TRANSLATORS: button label */}
    {_("Reload")}
  </Button>
);

function DBusError() {
  return (
    <Center>
      {/* TRANSLATORS: page title */}
      <PageTitle>{_("D-Bus Error")}</PageTitle>
      <PageIcon><Icon name="problem" /></PageIcon>
      <MainActions><ReloadAction /></MainActions>

      <EmptyState variant="xl">
        <EmptyStateHeader
          titleText={_("Cannot connect to D-Bus")}
          headingLevel="h2"
          icon={<EmptyStateIcon icon={ErrorIcon} />}
        />
        <EmptyStateBody>
          {_("Could not connect to the D-Bus service. Please, check whether it is running.")}
        </EmptyStateBody>
      </EmptyState>
    </Center>
  );
}

export default DBusError;
