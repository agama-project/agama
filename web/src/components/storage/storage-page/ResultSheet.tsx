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
import { useSheetTab } from "~/components/storage/shared/use-sheet";
import DevicesManager from "~/model/storage/devices-manager";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import {
  useFlattenDevices as useProposalDevices,
  useActions,
} from "~/hooks/model/proposal/storage";
import { _ } from "~/i18n";

/**
 * The whole picture, which the page's summary reports one clause of.
 *
 * Two halves of the same answer: every change the installer carries out, and
 * what the machine looks like once it has. Tabs rather than one under the
 * other, so both headings stay visible whatever the length of the list under
 * them, and a reader deciding whether they can afford the changes is not made
 * to scroll past all of them to see the result.
 */
export default function ResultSheet(): React.ReactNode {
  const system = useSystemDevices();
  const staging = useProposalDevices();
  const actions = useActions();
  const [tab, setTab] = useSheetTab("actions");
  const manager = new DevicesManager(system, staging, actions);

  return (
    <Tabs
      activeKey={tab}
      onSelect={(_event, key) => setTab(String(key))}
      // TRANSLATORS: names the pair of tabs offering the changes the installer
      // will make and the layout they leave behind.
      aria-label={_("What will happen")}
    >
      {/* The same word the page's own line uses, since that line is what opens
          this. Two vocabularies for one fact is worse than either. */}
      <Tab eventKey="actions" title={<TabTitleText>{_("Actions")}</TabTitleText>}>
        <ProposalActions actions={actions} />
      </Tab>
      <Tab eventKey="layout" title={<TabTitleText>{_("Final layout")}</TabTitleText>}>
        <ProposalResultTable devicesManager={manager} />
      </Tab>
    </Tabs>
  );
}
