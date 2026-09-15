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
import { Tab, Tabs, TabTitleIcon, TabTitleText } from "@patternfly/react-core";
import Icon, { IconProps } from "~/components/layout/Icon";
import FinalLayoutSection from "~/components/storage/device-sheet/FinalLayoutSection";
import PlannedContentSection from "~/components/storage/device-sheet/PlannedContentSection";
import CurrentContentSection, {
  hasCurrentContent,
} from "~/components/storage/device-sheet/CurrentContentSection";
import PropertiesSection from "~/components/storage/device-sheet/PropertiesSection";
import TabNote from "~/components/storage/device-sheet/TabNote";
import UsedByStatement from "~/components/storage/device-sheet/UsedByStatement";
import BootStatement from "~/components/storage/device-sheet/BootStatement";
import { useSheetTab } from "~/components/storage/shared/use-sheet";
import { useTablistKeyboard } from "~/hooks/use-tablist-keyboard";
import { _, TranslatedString } from "~/i18n";
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
/**
 * One mark per view, chosen for what the view is about rather than for storage:
 * the shape the device ends up in, work still to be carried out, what the entry
 * is built from, and the hardware as it stands.
 *
 * Decorative, and hidden from a screen reader: the words beside each say what
 * the view holds. The marks are there to tell them apart at a glance.
 */
const VIEW_ICONS: Record<string, IconProps["name"]> = {
  result: "schema",
  planned: "pending_actions",
  properties: "device_hub",
  current: "hard_drive",
};

function title(view: string, name: React.ReactNode) {
  return (
    <>
      <TabTitleIcon>
        <Icon name={VIEW_ICONS[view]} size="sm" />
      </TabTitleIcon>
      <TabTitleText>{name}</TabTitleText>
    </>
  );
}

export default function DeviceDetail({ entry, subject }: DeviceDetailProps): React.ReactNode {
  const [tab, setTab] = useSheetTab("result");
  /* Only an entry that is defined rather than found has properties: a volume
     group, or a RAID made of other disks. A disk is the hardware. */
  const hasProperties = entry.isVolumeGroup || subject.collection === "mdRaids";
  /* Only where the machine has something on the entry today. On an empty disk,
     or a volume group being defined, the view's whole answer is that there is
     nothing, and a tab whose answer is nothing costs a reader the click that
     finds it out. */
  const hasCurrent = hasCurrentContent(entry);
  const views = [
    "result",
    "planned",
    ...(hasProperties ? ["properties"] : []),
    ...(hasCurrent ? ["current"] : []),
  ];
  /* An address can name a view this entry is not offered: one address serves
     every entry, and a reader moving from a disk with partitions to one without
     keeps the view they were reading. That opens on the first rather than on a
     strip with nothing selected. */
  const view = views.includes(tab) ? tab : "result";
  const { containerProps, tabProps } = useTablistKeyboard(views, view, setTab);

  /* The views as the notes name them, and the way to each. */
  const go = (view: string, name: TranslatedString) => ({ name, onGo: () => setTab(view) });
  // TRANSLATORS: names a view of a device, as a link inside a sentence.
  const toPlanned = go("planned", _("Planned content"));
  // TRANSLATORS: names a view of a device, as a link inside a sentence.
  const toCurrent = go("current", _("Current content"));
  // TRANSLATORS: names a view of a device, as a link inside a sentence.
  const toResult = go("result", _("Final layout"));

  /* Whole sentences per kind of entry: an article and a noun agree in most
     languages, and a slot taking either "disk" or "volume group" would leave a
     translator unable to make them. */
  const isRaid = subject.collection === "mdRaids";
  const resultLead = () => {
    // TRANSLATORS: opens the view showing the shape an LVM volume group is left in.
    if (entry.isVolumeGroup) return _("How this volume group looks once the installer is done.");
    // TRANSLATORS: opens the view showing the shape a software RAID is left in.
    if (isRaid) return _("How this RAID device looks once the installer is done.");
    // TRANSLATORS: opens the view showing the shape a disk is left in.
    return _("How this disk looks once the installer is done.");
  };
  const plannedLead = () => {
    // TRANSLATORS: opens the view showing what an LVM volume group will hold.
    if (entry.isVolumeGroup) return _("What this volume group will hold for the new system.");
    // TRANSLATORS: opens the view showing what a software RAID will hold.
    if (isRaid) return _("What this RAID device will hold for the new system.");
    // TRANSLATORS: opens the view showing what a disk will hold.
    return _("What this disk will hold for the new system.");
  };

  return (
    <div {...containerProps}>
      <Tabs
        activeKey={view}
        onSelect={(_event, key) => setTab(String(key))}
        // TRANSLATORS: names the strip of views of one device of the installation.
        aria-label={_("Views of this device")}
      >
        <Tab
          eventKey="result"
          {...tabProps("result")}
          title={title(
            "result",
            <>
              {/* TRANSLATORS: names the view of a device showing the shape it is
                  left in once the installation has run. */}
              {_("Final layout")}
            </>,
          )}
        >
          <TabNote
            lead={resultLead()}
            where={
              hasCurrent
                ? // TRANSLATORS: says where the final layout of a device changes.
                  // %1$s and %2$s are the names of two other views, shown as links.
                  _("It follows from the %1$s and %2$s tabs, which is where it changes.")
                : // TRANSLATORS: says where the final layout of a device changes.
                  // %s is the name of another view, shown as a link.
                  _("It follows from the %s tab, which is where it changes.")
            }
            links={hasCurrent ? [toPlanned, toCurrent] : [toPlanned]}
          />
          <FinalLayoutSection entry={entry} />
        </Tab>
        <Tab
          eventKey="planned"
          {...tabProps("planned")}
          title={title(
            "planned",
            <>
              {/* TRANSLATORS: names the view of a device showing what the
                  installation will put on it. */}
              {_("Planned content")}
            </>,
          )}
        >
          <TabNote
            lead={plannedLead()}
            where={
              hasCurrent
                ? // TRANSLATORS: says where room is made for what a device will
                  // hold. %s is the name of another view, shown as a link.
                  _(
                    "Making room for it may mean deleting or shrinking what is there today, decided in the %s tab.",
                  )
                : undefined
            }
            links={hasCurrent ? [toCurrent] : []}
          >
            {/* What is true of the device itself, said with the note rather
                than above the table: they are all prose about the device, and
                the table below is the view's content. Each decides for itself
                whether it has anything to say. */}
            <UsedByStatement entry={entry} />
            <BootStatement entry={entry} />
          </TabNote>
          <PlannedContentSection entry={entry} subject={subject} />
        </Tab>
        {/* Only where the entry is defined rather than found. A disk is the
            hardware, so there is nothing that defines it to show. */}
        {hasProperties && (
          <Tab
            eventKey="properties"
            {...tabProps("properties")}
            title={title(
              "properties",
              <>
                {/* TRANSLATORS: names the view of an entry showing the other
                    entries it is built from. */}
                {_("Properties")}
              </>,
            )}
          >
            <TabNote
              lead={
                entry.isVolumeGroup
                  ? // TRANSLATORS: opens the view showing what an LVM volume group
                    // is built from.
                    _("What this volume group is made of, and how it is defined.")
                  : // TRANSLATORS: opens the view showing what a software RAID is
                    // built from.
                    _("What this RAID device is made of, and how it is defined.")
              }
              // TRANSLATORS: says where to read what a volume group will hold.
              // %s is the name of another view, shown as a link.
              where={_("What it will hold is in the %s tab.")}
              links={[toPlanned]}
            />
            <PropertiesSection entry={entry} />
          </Tab>
        )}
        {/* Only where the machine has something on the entry today. */}
        {hasCurrent && (
          <Tab
            eventKey="current"
            {...tabProps("current")}
            title={title(
              "current",
              <>
                {/* TRANSLATORS: names the view of a device showing what was on
                    it before the installation was planned. */}
                {_("Current content")}
              </>,
            )}
          >
            <TabNote
              // TRANSLATORS: opens the view listing what is on a device today.
              lead={_("What to do with the existing partitions")}
              // TRANSLATORS: says what this view is for and where its result is
              // shown. %s is the name of another view, shown as a link.
              where={_(
                "Choose how the installer should use the existing partitions. The %s tab shows the resulting disk layout.",
              )}
              links={[toResult]}
            />
            <CurrentContentSection entry={entry} subject={subject} />
          </Tab>
        )}
      </Tabs>
    </div>
  );
}
