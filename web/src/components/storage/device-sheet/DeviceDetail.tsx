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
import FinalLayoutSection from "~/components/storage/device-sheet/FinalLayoutSection";
import PlannedContentSection from "~/components/storage/device-sheet/PlannedContentSection";
import CurrentContentSection from "~/components/storage/device-sheet/CurrentContentSection";
import PropertiesSection from "~/components/storage/device-sheet/PropertiesSection";
import { useSheetTab } from "~/components/storage/shared/use-sheet";
import { useTablistKeyboard } from "~/hooks/use-tablist-keyboard";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";

export type DeviceDetailProps = {
  entry: Entry;
  /** Where the entry is written, which is what the acts on its parts need. */
  subject: SheetEntry;
};

/**
 * What one entry of the plan holds, read left to right as time moving forwards.
 *
 * The strip opens on what the device becomes, so someone who came to check is
 * already looking at the answer; only someone who came to change has to move
 * along. Which view is open lives in the address beside the entry, so a reader
 * comparing two devices is not sent back to the first view between them.
 *
 * Nothing in the names says partition or volume: the same strip serves a disk,
 * a RAID and a volume group, and what each holds goes by a different word. Each
 * entry decides its own strip: a disk has nothing that defines it, so it is not
 * offered a view about that.
 *
 * The strip carries its own keyboard: PatternFly's tabs are each a tab stop and
 * no arrow key does anything, where the pattern asks for one stop for the strip
 * and arrows within it.
 */
export default function DeviceDetail({ entry, subject }: DeviceDetailProps): React.ReactNode {
  const [tab, setTab] = useSheetTab("result");
  const views = ["result", "planned", ...(entry.isVolumeGroup ? ["properties"] : []), "current"];
  const { containerProps, tabProps } = useTablistKeyboard(views, tab, setTab);

  return (
    <div {...containerProps}>
      <Tabs
        activeKey={tab}
        onSelect={(_event, key) => setTab(String(key))}
        // TRANSLATORS: names the strip of views of one device of the installation.
        aria-label={_("Views of this device")}
      >
        <Tab
          eventKey="result"
          {...tabProps("result")}
          title={
            <TabTitleText>
              {/* TRANSLATORS: names the view of a device showing the shape it is
                  left in once the installation has run. */}
              {_("Final layout")}
            </TabTitleText>
          }
        >
          <FinalLayoutSection entry={entry} />
        </Tab>
        <Tab
          eventKey="planned"
          {...tabProps("planned")}
          title={
            <TabTitleText>
              {/* TRANSLATORS: names the view of a device showing what the
                  installation will put on it. */}
              {_("Planned content")}
            </TabTitleText>
          }
        >
          <PlannedContentSection entry={entry} subject={subject} />
        </Tab>
        {/* Only where the entry is defined rather than found. A disk is the
            hardware, so there is nothing that defines it to show. */}
        {entry.isVolumeGroup && (
          <Tab
            eventKey="properties"
            {...tabProps("properties")}
            title={
              <TabTitleText>
                {/* TRANSLATORS: names the view of an entry showing the other
                    entries it is built from. */}
                {_("Properties")}
              </TabTitleText>
            }
          >
            <PropertiesSection entry={entry} />
          </Tab>
        )}
        <Tab
          eventKey="current"
          {...tabProps("current")}
          title={
            <TabTitleText>
              {/* TRANSLATORS: names the view of a device showing what was on it
                  before the installation was planned. */}
              {_("Current content")}
            </TabTitleText>
          }
        >
          <CurrentContentSection entry={entry} subject={subject} />
        </Tab>
      </Tabs>
    </div>
  );
}
