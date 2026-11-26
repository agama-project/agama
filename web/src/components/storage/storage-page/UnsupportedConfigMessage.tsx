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
import {
  Button,
  Content,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  Split,
  SplitItem,
} from "@patternfly/react-core";
import Popup from "~/components/core/Popup";
import { summaryOf } from "~/components/storage/storage-page/Consequences";
import PlannedChangesPopup from "~/components/storage/storage-page/PlannedChangesPopup";
import Icon from "~/components/layout/Icon";
import { useReset } from "~/hooks/model/config/storage";
import { useActions } from "~/hooks/model/proposal/storage";
import { _ } from "~/i18n";

/** A button opening the planned changes, when a layout was calculated. */
function PreviewResult(): React.ReactNode {
  const actions = useActions();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button variant="tertiary" onClick={() => setIsOpen(true)}>
        {_("Preview result")}
      </Button>
      {isOpen && (
        <Popup
          isOpen
          // TRANSLATORS: title of the popup with the layout the disks will have
          // and the actions needed to get there. "Planned" because nothing is
          // applied until the installation starts.
          title={_("Planned storage changes")}
          description={summaryOf(actions)}
          variant="large"
          className="agm-planned-changes-popup"
          onClose={() => setIsOpen(false)}
          actions={<Popup.Close />}
        >
          <PlannedChangesPopup />
        </Popup>
      )}
    </>
  );
}

/**
 * Shown instead of the page when the storage configuration is valid but made
 * of things this interface cannot represent, so it cannot be changed here. The
 * result can still be previewed, and the user can start over.
 */
export default function UnsupportedConfigMessage(): React.ReactNode {
  const reset = useReset();

  return (
    <EmptyState
      headingLevel="h2"
      titleText={_("Unable to modify the settings")}
      icon={() => <Icon name="info" />}
      status="info"
    >
      <EmptyStateBody>
        <Content component="p">
          {_(
            "The storage configuration is correct and the installation can proceed, but it uses elements not supported by this interface.",
          )}
        </Content>
      </EmptyStateBody>
      <EmptyStateFooter>
        <Content component="p">
          {_(
            "You may want to discard the current settings and start from scratch with a simple configuration.",
          )}
        </Content>
        <Split hasGutter>
          <SplitItem>
            <PreviewResult />
          </SplitItem>
          <SplitItem>
            <Button variant="tertiary" onClick={() => reset()}>
              {_("Reset to the default configuration")}
            </Button>
          </SplitItem>
        </Split>
      </EmptyStateFooter>
    </EmptyState>
  );
}
