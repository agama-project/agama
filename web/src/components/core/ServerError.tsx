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
import {
  Bullseye,
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
} from "@patternfly/react-core";
import { Icon, PlainLayout } from "~/components/layout";
import { Page } from "~/components/core";
import { locationReload } from "~/utils";
import shadowUtils from "@patternfly/react-styles/css/utilities/BoxShadow/box-shadow";
import { _ } from "~/i18n";

const ErrorIcon = () => <Icon name="error" />;

function ServerError() {
  return (
    <PlainLayout mountHeader={false} mountSidebar={false}>
      <Page>
        <Page.Content>
          <Bullseye>
            <Page.Section pfCardProps={{ isFullHeight: false, className: shadowUtils.boxShadowMd }}>
              <EmptyState
                variant="xl"
                titleText={_("Cannot connect to Agama server")}
                headingLevel="h1"
                icon={ErrorIcon}
                status="warning"
              >
                <EmptyStateBody>{_("Please, check whether it is running.")}</EmptyStateBody>
                <EmptyStateFooter>
                  <Button variant="primary" size="lg" onClick={locationReload}>
                    {_("Reload")}
                  </Button>
                </EmptyStateFooter>
              </EmptyState>
            </Page.Section>
          </Bullseye>
        </Page.Content>
      </Page>
    </PlainLayout>
  );
}

export default ServerError;
