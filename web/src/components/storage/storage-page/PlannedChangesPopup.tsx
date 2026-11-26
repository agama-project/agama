/*
 * Copyright (c) [2026] SUSE LLC
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
import { Tab, Tabs, TabTitleText } from "@patternfly/react-core";
import ProposalActions from "~/components/storage/ProposalActions";
import ProposalResultTable from "~/components/storage/ProposalResultTable";
import ProposalHighlightedActions from "~/components/storage/ProposalHighlightedActions";
import { useTablistKeyboard } from "~/hooks/use-tablist-keyboard";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { useActions } from "~/hooks/model/proposal/storage";
import { _ } from "~/i18n";

/**
 * The planned storage changes in two tabs: the actions the installer performs
 * and the final layout they lead to.
 */
export default function PlannedChangesPopup(): React.ReactNode {
  const actions = useActions();
  const manager = useDevicesManager();
  /* Not kept in the address, like the popup itself. */
  const [tab, setTab] = React.useState("actions");
  const { containerProps, tabProps } = useTablistKeyboard(["actions", "layout"], tab, setTab);

  return (
    <div {...containerProps}>
      <ProposalHighlightedActions />
      <Tabs
        activeKey={tab}
        onSelect={(_event, key) => setTab(String(key))}
        mountOnEnter
        // TRANSLATORS: names the tabs with the planned actions and the final layout
        aria-label={_("What will happen")}
      >
        <Tab
          eventKey="actions"
          {...tabProps("actions")}
          title={<TabTitleText>{_("Actions")}</TabTitleText>}
        >
          <ProposalActions actions={actions} />
        </Tab>
        <Tab
          eventKey="layout"
          {...tabProps("layout")}
          title={<TabTitleText>{_("Final layout")}</TabTitleText>}
        >
          <ProposalResultTable devicesManager={manager} />
        </Tab>
      </Tabs>
    </div>
  );
}
