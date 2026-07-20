/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { Content, HelperText, HelperTextItem } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import StandaloneLayout from "~/components/layout/StandaloneLayout";
import { _ } from "~/i18n";

export default function InstallationExit() {
  return (
    <Page variant="minimal">
      <Page.Content>
        <StandaloneLayout
          icon="restart_alt"
          title={_("The system is rebooting")}
          description={
            <HelperText>
              <HelperTextItem>
                {_("The installer interface is no longer available.")}
              </HelperTextItem>
            </HelperText>
          }
        >
          <Content isEditorial>{_("You can safely close this window.")}</Content>
        </StandaloneLayout>
      </Page.Content>
    </Page>
  );
}
