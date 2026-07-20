/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { Button, Content, Flex } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import SideBySideLayout from "~/components/layout/SideBySideLayout";
import { locationReload } from "~/utils";
import { _ } from "~/i18n";

function ServerError() {
  return (
    <Page variant="minimal">
      <Page.Content>
        <SideBySideLayout icon="error" title={_("Cannot connect")}>
          <Flex
            direction={{ default: "column" }}
            alignItems={{ default: "alignItemsFlexStart" }}
            gap={{ default: "gapMd" }}
          >
            <Content>{_("Check whether Agama server is running.")}</Content>
            <Button variant="primary" onClick={locationReload}>
              {_("Reload")}
            </Button>
          </Flex>
        </SideBySideLayout>
      </Page.Content>
    </Page>
  );
}

export default ServerError;
