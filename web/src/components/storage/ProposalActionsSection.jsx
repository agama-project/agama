/*
 * Copyright (c) [2022-2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import React, { useState } from "react";
import {
  List,
  ListItem,
  ExpandableSection,
  Skeleton,
} from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { _, n_ } from "~/i18n";
import { deviceSize } from "~/components/storage/utils";
import { If, Section, TreeTable } from "~/components/core";
import { partition } from "~/utils";

// TODO: would be nice adding an aria-description to these lists, but aria-description still in
// draft yet and aria-describedby should be used... which id not ideal right now
// https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-description
const ActionsList = ({ actions }) => {
  // Some actions (e.g., deleting a LV) are reported as several actions joined by a line break
  const actionItems = (action, id) => {
    return action.text.split("\n").map((text, index) => {
      return (
        <ListItem key={`${id}-${index}`} className={action.delete ? "proposal-action--delete" : null}>
          {text}
        </ListItem>
      );
    });
  };

  const items = actions.map(actionItems).flat();

  return <List className="proposal-actions">{items}</List>;
};

/**
 * Renders the list of actions to perform in the system
 * @component
 *
 * @param {object} props
 * @param {object[]} [props.actions=[]]
 */
const ProposalActions = ({ actions = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (actions.length === 0) return null;

  const [generalActions, subvolActions] = partition(actions, a => !a.subvol);
  const toggleText = isExpanded
    // TRANSLATORS: show/hide toggle action, this is a clickable link
    ? sprintf(n_("Hide %d subvolume action", "Hide %d subvolume actions", subvolActions.length), subvolActions.length)
    // TRANSLATORS: show/hide toggle action, this is a clickable link
    : sprintf(n_("Show %d subvolume action", "Show %d subvolume actions", subvolActions.length), subvolActions.length);

  return (
    <>
      <ActionsList actions={generalActions} />
      {subvolActions.length > 0 && (
        <ExpandableSection
          isIndented
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          toggleText={toggleText}
          className="expandable-actions"
        >
          <ActionsList actions={subvolActions} />
        </ExpandableSection>
      )}
    </>
  );
};

/**
 * @todo Create a component for rendering a customized skeleton
 */
const ActionsSkeleton = () => {
  return (
    <>
      <Skeleton width="80%" />
      <Skeleton width="65%" />
      <Skeleton width="70%" />
      <Skeleton width="65%" />
      <Skeleton width="40%" />
    </>
  );
};

const DeleteActions = ({ actions }) => {
  const deleteActions = actions.filter(a => a.delete);

  // TODO Add show the deleted system if any
  return (
    <ul>
      {deleteActions.map((a, i) => <li key={i}>{a.text}</li>)}
    </ul>
  );
};

const DevicesResult = ({ settings, devices }) => {
  const { system = [], staging = [] } = devices;

  const usedDevices = () => {
    const sids = settings.installationDevices.map(d => d.sid);
    const instDevices = staging.filter(d => sids.includes(d.sid));
    const lvmVgs = staging.filter(d => d.logicalVolumes?.find(l => l.filesystem?.mountPath !== undefined));

    // FIXME This is only to avoid showing the existing VG of my VM. Remove and use lvmVgs.
    const newLvmVgs = lvmVgs.filter(v => system.find(d => d.sid === v.sid) === undefined);

    return instDevices.concat(newLvmVgs);
  };

  const children = (device) => {
    const partitionTableChildren = (partitionTable) => {
      const { partitions, unusedSlots } = partitionTable;
      const children = partitions.concat(unusedSlots);

      return children.sort((a, b) => a.start < b.start ? -1 : 1);
    };

    const lvmVgChildren = (lvmVg) => {
      return lvmVg.logicalVolumes.sort((a, b) => a.name < b.name ? -1 : 1);
    };

    if (device.partitionTable) return partitionTableChildren(device.partitionTable);
    if (device.type === "lvmVg") return lvmVgChildren(device);
    return [];
  };

  const renderDeviceName = (item) => {
    const newLabel = (device) => {
      const systemDevice = system.find(d => d.sid === device.sid);
      if (device.sid && !systemDevice) return _("(new)");
    };

    return (
      <div className="split">
        <span>{item.sid && item.name}</span>
        <span><em>{newLabel(item)}</em></span>
      </div>
    );
  };

  const renderDetails = (item) => {
    if (!item.sid) return _("Unused space");

    return (
      <div className="split">
        {/* <span><em>{newLabel(item)}</em></span> */}
        <span>{item.description}</span>
        <span><b>{item.filesystem?.label}</b></span>
      </div>
    );
  };

  const renderSize = (item) => deviceSize(item.size);

  const renderMountPoint = (item) => item.sid && item.filesystem?.mountPath;

  return (
    <TreeTable
      columns={[
        { title: _("Device"), content: renderDeviceName },
        { title: _("Details"), content: renderDetails },
        { title: _("Size"), content: renderSize, classNames: "text-end" },
        { title: _("Mount Point"), content: renderMountPoint }
      ]}
      items={usedDevices()}
      itemChildren={children}
      rowClassNames={(item) => {
        if (!item.sid) return "dimmed-row";
      }}
    />
  );
};

/**
 * Section with the actions to perform in the system
 * @component
 *
 * @param {object} props
 * @param {object[]} [props.actions=[]]
 * @param {string[]} [props.errors=[]]
 * @param {boolean} [props.isLoading=false] - Whether the section content should be rendered as loading
 */
export default function ProposalActionsSection({
  actions,
  settings,
  devices,
  errors = [],
  isLoading = false
}) {
  if (isLoading) errors = [];

  console.log("devices: ", devices);

  return (
    <Section
      // TRANSLATORS: The storage "Planned Actions" section's title. The
      // section shows a list of planned actions for the selected device, e.g.
      // "delete partition A", "create partition B with filesystem C", ...
      title={_("Planned Actions")}
      // TRANSLATORS: The storage "Planned Actions" section's description
      description={_("Actions to create the file systems and to ensure the new system boots.")}
      id="storage-actions"
      errors={errors}
    >
      <If
        condition={isLoading}
        then={<ActionsSkeleton />}
        else={
          <>
            <DeleteActions actions={actions} />
            <DevicesResult settings={settings} devices={devices} />
            <ProposalActions actions={actions} />
          </>
        }
      />
    </Section>
  );
}
