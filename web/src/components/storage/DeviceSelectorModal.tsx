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

import React, { useId, useState } from "react";
import { first } from "radashi";
import { sprintf } from "sprintf-js";
import {
  ButtonProps,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Flex,
  HelperText,
  HelperTextItem,
  PageSection,
  Stack,
  Tab,
  Tabs,
} from "@patternfly/react-core";
import Annotation from "~/components/core/Annotation";
import Link from "~/components/core/Link";
import NestedContent from "~/components/core/NestedContent";
import Popup from "~/components/core/Popup";
import SubtleContent from "~/components/core/SubtleContent";
import DrivesTable from "~/components/storage/DrivesTable";
import MdRaidsTable from "~/components/storage/MdRaidsTable";
import VolumeGroupsTable from "~/components/storage/VolumeGroupsTable";
import { STORAGE } from "~/routes/paths";
import { deviceLabel } from "~/components/storage/utils";
import { _ } from "~/i18n";

import type { DistributedOmit } from "type-fest";
import type { PopupProps } from "~/components/core/Popup";
import type { Storage } from "~/model/system";

/** Identifies which tab is active in {@link DeviceSelectorModal}. */
export type TabKey = "disks" | "mdRaids" | "volumeGroups";

/** Tab keys for device types that can be created (excludes disks). */
export type CreatableTabKey = "mdRaids" | "volumeGroups";

/** Side effects shown when selecting a device from a specific tab. */
export type SideEffects = {
  [K in TabKey]?: React.ReactNode;
};

/** Introductory content shown at the top of each tab. */
export type TabIntros = {
  [K in TabKey]?: React.ReactNode;
};

/** Empty state titles for each tab when no devices are available. */
export type EmptyStateTitles = {
  [K in TabKey]?: React.ReactNode;
};

/** Empty state body text for each tab when no devices are available. */
export type EmptyStateBodies = {
  [K in TabKey]?: React.ReactNode;
};

/**
 * Link text for creating new devices.
 * Only available for device types that can be created (excludes disks).
 */
export type NewDeviceLinkTexts = {
  [K in CreatableTabKey]?: React.ReactNode;
};

/** Props for {@link DeviceSelectorModal}. */
export type DeviceSelectorModalProps = DistributedOmit<
  PopupProps,
  "children" | "selected" | "description" | "isOpen" | "actions" | "onClose"
> & {
  /** General information shown at the top of the modal, above the tabs. */
  intro?: React.ReactNode;
  /** Tab to open initially. Takes precedence over the tab derived from {@link selected}. */
  initialTab?: TabKey;
  /** Currently selected device. Determines the initial tab and initial selection. */
  selected?: Storage.Device;
  /** Available disks. */
  disks?: Storage.Device[];
  /** Available software RAID devices. */
  mdRaids?: Storage.Device[];
  /** Available LVM volume groups. */
  volumeGroups?: Storage.Device[];
  /**
   * Side effects shown when selecting a device from a specific tab.
   * Only shown when the selection differs from {@link selected}.
   */
  sideEffects?: SideEffects;
  /**
   * Introductory content shown at the top of each tab.
   * Not rendered when the tab is empty (empty state is shown instead).
   */
  tabIntros?: TabIntros;
  /** Custom titles for empty states. Defaults are provided for each tab. */
  emptyStateTitles?: EmptyStateTitles;
  /** Custom body text for empty states. Defaults are provided for each tab. */
  emptyStateBodies?: EmptyStateBodies;
  /**
   * Link text for creating new devices in each tab.
   * When set, a link is shown with this text. Only available for creatable device types.
   */
  newDeviceLinkTexts?: NewDeviceLinkTexts;
  /**
   * Whether switching tabs auto-selects the first device of the new tab,
   * or clears the selection when the tab is empty. Defaults to `true`.
   */
  autoSelectOnTabChange?: boolean;
  /** Called with the new selection when the user confirms. */
  onConfirm: (selection: Storage.Device[]) => void;
  /** Called when the user cancels. */
  onCancel: ButtonProps["onClick"];
};

const TABS: Record<TabKey, number> = { disks: 0, mdRaids: 1, volumeGroups: 2 };

/** Empty state shown in a tab when no devices of that type are available. */
const NoDevicesFound = ({
  title,
  body,
  action,
}: {
  title: React.ReactNode;
  body: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <EmptyState headingLevel="h4" titleText={title} variant="sm">
    <EmptyStateBody>{body}</EmptyStateBody>
    {action && (
      <EmptyStateFooter>
        <EmptyStateActions>{action}</EmptyStateActions>
      </EmptyStateFooter>
    )}
  </EmptyState>
);

/**
 * Renders a link to create a new device, styled as subtle content.
 * The link position and text are extracted from `text` using `[text]` markers.
 */
const CreateDeviceLink = ({ text, to }: { text: string; to: string }) => {
  const [before, linkText, after] = text.split(/[[\]]/);
  return (
    <SubtleContent>
      {before}
      <Link to={to} variant="link" isInline>
        {linkText}
      </Link>
      {after}
    </SubtleContent>
  );
};

/**
 * Wrapper for a tab's scrollable content area. Renders `children` when given,
 * or falls back to {@link NoDevicesFound} built from the `empty*` props.
 */
const TabContent = ({
  emptyTitle,
  emptyBody,
  emptyAction,
  intro,
  children,
}: {
  emptyTitle: React.ReactNode;
  emptyBody: React.ReactNode;
  emptyAction?: React.ReactNode;
  intro?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <NestedContent margin="myMd">
    <NestedContent margin="mxSm">
      {children ? (
        <>
          {intro}
          {children}
        </>
      ) : (
        <NoDevicesFound title={emptyTitle} body={emptyBody} action={emptyAction} />
      )}
    </NestedContent>
  </NestedContent>
);

/**
 * Returns the tab index to activate when the modal opens.
 *
 * Resolution order:
 * 1. Explicit `initialTab` key.
 * 2. Tab that contains `selected`.
 * 3. First tab (index 0).
 */
function getInitialTabIndex(
  initialTab?: TabKey,
  selected?: Storage.Device,
  deviceLists?: Storage.Device[][],
): number {
  if (initialTab) return TABS[initialTab];

  if (selected && deviceLists) {
    const index = deviceLists.findIndex((list) => list.some((d) => d.sid === selected.sid));
    return index !== -1 ? index : 0;
  }

  return 0;
}

/**
 * Modal for selecting a storage device across three categories: disks,
 * software RAID devices, and LVM volume groups.
 *
 * The confirm button label reflects the state of the selection:
 *
 *   - "Add X" when there is no prior device and one is selected,
 *   - "Keep X" when the selection matches {@link
 *      DeviceSelectorModalProps.selected},
 *   - "Change to X" when a different device is picked,
 *   - "Add" or "Change" when no device is selected (e.g. after switching to an
 *      empty tab).
 *
 * An optional side-effects alert is displayed near the confirm button when the
 * user switches to a different device. Both the alert and the "Select a device"
 * hint are live regions linked to the confirm button via `aria-describedby` so
 * assistive technologies announce changes.
 */
export default function DeviceSelectorModal({
  selected: previousDevice,
  initialTab,
  onConfirm,
  onCancel,
  intro,
  disks = [],
  mdRaids = [],
  volumeGroups = [],
  sideEffects,
  tabIntros,
  emptyStateTitles,
  emptyStateBodies,
  newDeviceLinkTexts,
  autoSelectOnTabChange = true,
  ...popupProps
}: DeviceSelectorModalProps): React.ReactNode {
  const confirmHintId = useId();
  const initialDevice = previousDevice ?? first([...disks, ...mdRaids, ...volumeGroups]);
  const [selectedDevices, setSelectedDevices] = useState<Storage.Device[]>(
    initialDevice ? [initialDevice] : [],
  );
  const [activeTab, setActiveTab] = useState(() =>
    getInitialTabIndex(initialTab, initialDevice, [disks, mdRaids, volumeGroups]),
  );
  const tabLists = [disks, mdRaids, volumeGroups];

  const currentDevice = selectedDevices[0];
  const deviceSideEffectsAlert =
    currentDevice &&
    [
      { list: disks, alert: sideEffects?.disks },
      { list: mdRaids, alert: sideEffects?.mdRaids },
      { list: volumeGroups, alert: sideEffects?.volumeGroups },
    ].find(({ list }) => list.some((d) => d.sid === currentDevice.sid))?.alert;

  const deviceInInitialTab =
    currentDevice && tabLists[activeTab].some((d) => d.sid === currentDevice.sid);

  const onTabClick = (_, tabIndex: number) => {
    setActiveTab(tabIndex);
    if (autoSelectOnTabChange) {
      const device = first(tabLists[tabIndex]);
      setSelectedDevices(device ? [device] : []);
    }
  };

  const confirmLabel = (): string => {
    if (!currentDevice) return previousDevice ? _("Change") : _("Add");
    // TRANSLATORS: %s is replaced by a device label, e.g. "sda (512 GiB)"
    if (!previousDevice) return sprintf(_("Add %s"), deviceLabel(currentDevice));
    // TRANSLATORS: %s is replaced by a device label, e.g. "sda (512 GiB)"
    if (currentDevice.sid === previousDevice.sid)
      return sprintf(_("Keep %s"), deviceLabel(currentDevice));
    // TRANSLATORS: %s is replaced by a device label, e.g. "sda (512 GiB)"
    return sprintf(_("Change to %s"), deviceLabel(currentDevice));
  };

  const actions = (
    <Stack hasGutter>
      {!currentDevice && (
        <HelperText id={confirmHintId} isLiveRegion>
          <HelperTextItem variant="warning">{_("Select a device")}</HelperTextItem>
        </HelperText>
      )}
      {currentDevice && currentDevice.sid !== previousDevice?.sid && deviceSideEffectsAlert && (
        <HelperText id={confirmHintId} isLiveRegion>
          <HelperTextItem>
            <Annotation icon="notifications_ative">{deviceSideEffectsAlert}</Annotation>
          </HelperTextItem>
        </HelperText>
      )}
      <Flex>
        <Popup.Confirm
          onClick={() => onConfirm(selectedDevices)}
          isDisabled={!currentDevice}
          aria-describedby={confirmHintId}
        >
          {confirmLabel()}
        </Popup.Confirm>
        <Popup.Cancel onClick={onCancel} asLink />
      </Flex>
    </Stack>
  );

  return (
    <Popup
      isOpen
      variant="medium"
      description={_("Use the tabs to browse disks, RAID devices and LVM volume groups.")}
      elementToFocus={deviceInInitialTab ? "input[type=radio]:checked" : undefined}
      actions={actions}
      onClose={onCancel}
      {...popupProps}
      style={{ height: "70dvh" }}
    >
      <Stack hasGutter>
        {intro}
        <PageSection type="tabs">
          <Tabs
            activeKey={activeTab}
            onSelect={onTabClick}
            style={{
              position: "sticky",
              marginTop: "calc(var(--pf-t--global--spacer--sm) * -1)",
              top: "calc(var(--pf-t--global--spacer--sm) * -1)",
              zIndex: "var(--pf-t--global--z-index--md)",
              background: "var(--pf-t--global--background--color--primary--default)",
            }}
          >
            <Tab eventKey={0} title={_("Disks")}>
              <TabContent
                emptyTitle={emptyStateTitles?.disks || _("No disks found")}
                emptyBody={emptyStateBodies?.disks || _("No disks are available for selection.")}
                intro={tabIntros?.disks}
              >
                {disks.length > 0 && (
                  <DrivesTable
                    devices={disks}
                    selectedDevices={selectedDevices}
                    onSelectionChange={setSelectedDevices}
                  />
                )}
              </TabContent>
            </Tab>
            <Tab eventKey={1} title={_("RAID")}>
              <TabContent
                emptyTitle={emptyStateTitles?.mdRaids || _("No RAID devices found")}
                emptyBody={
                  emptyStateBodies?.mdRaids ||
                  _("No software RAID devices are available for selection.")
                }
                intro={tabIntros?.mdRaids}
              >
                {mdRaids.length > 0 && (
                  <MdRaidsTable
                    devices={mdRaids}
                    selectedDevices={selectedDevices}
                    onSelectionChange={setSelectedDevices}
                  />
                )}
              </TabContent>
            </Tab>
            <Tab eventKey={2} title={_("LVM")}>
              <TabContent
                emptyTitle={emptyStateTitles?.volumeGroups || _("No LVM volume groups found")}
                emptyBody={
                  emptyStateBodies?.volumeGroups ||
                  _("No LVM volume groups are available for selection.")
                }
                intro={tabIntros?.volumeGroups}
                emptyAction={
                  newDeviceLinkTexts?.volumeGroups && (
                    <Link to={STORAGE.volumeGroup.add}>{newDeviceLinkTexts.volumeGroups}</Link>
                  )
                }
              >
                {volumeGroups.length > 0 && (
                  <>
                    {newDeviceLinkTexts?.volumeGroups && (
                      <CreateDeviceLink
                        text={sprintf("[%s]", newDeviceLinkTexts.volumeGroups)}
                        to={STORAGE.volumeGroup.add}
                      />
                    )}
                    <VolumeGroupsTable
                      devices={volumeGroups}
                      selectedDevices={selectedDevices}
                      onSelectionChange={setSelectedDevices}
                    />
                  </>
                )}
              </TabContent>
            </Tab>
          </Tabs>
        </PageSection>
      </Stack>
    </Popup>
  );
}
