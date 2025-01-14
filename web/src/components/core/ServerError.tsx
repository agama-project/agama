/*
 * Copyright (c) [2022-2025] SUSE LLC
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

import React from "react";
import { Bullseye, EmptyState, EmptyStateBody } from "@patternfly/react-core";
import { Icon, PlainLayout } from "~/components/layout";
import { Page } from "~/components/core";
import { _ } from "~/i18n";
import { locationReload } from "~/utils";

const ErrorIcon = () => <Icon name="error" className="icon-xxxl" />;

function ServerError() {
  return (
    <PlainLayout mountHeader={false} mountSidebar={false}>
      <Page>
        <Page.Content>
          <Bullseye>
            <EmptyState
              variant="xl"
              titleText={_("Cannot connect to Agama server")}
              headingLevel="h2"
              icon={ErrorIcon}
            >
              <EmptyStateBody>{_("Please, check whether it is running.")}</EmptyStateBody>
            </EmptyState>
          </Bullseye>
        </Page.Content>

        <Page.Actions>
          <Page.Action onClick={locationReload}>{_("Reload")}</Page.Action>
        </Page.Actions>
      </Page>
    </PlainLayout>
  );
}

export default ServerError;
