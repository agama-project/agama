/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React from "react";
import { Alert, Skeleton } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { deviceSize } from "~/components/storage/utils";
import { If, Section, Tag, TreeTable } from "~/components/core";

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

/**
 * Returns the delete actions from given list
 *
 * @param {object[]} actions
 * @returns {object[]}
 */
const deleteActions = (actions) => actions.filter(a => a.delete);

/**
 * Renders a warning alert if there are delete actions
 *
 * @param {object} props
 * @param {object} props.deleteActions
 */
const Warning = ({ deleteActions }) => {
  const count = deleteActions.length;

  if (count === 0) return;

  const title = sprintf(_("%s delete actions will be performed"), count);

  return (
    <Alert isInline variant="warning" title={title}>
      <ul>
        { deleteActions.map(a => <li key={a.device}><strong>{a.text}</strong></li>)}
      </ul>
    </Alert>
  );
};

/**
 * Renders a TreeTable rendering the devices proposal result
 *
 * @param {object} props
 * @param {object} props.settings
 * @param {object} props.devices
 */
const DevicesTreeTable = ({ settings, devices }) => {
  const { system: systemDevices = [], staging: stagingDevices = [] } = devices;

  const sids = settings.installationDevices.map(d => d.sid);
  const installationDevices = stagingDevices.filter(d => sids.includes(d.sid));
  const lvmVgs = stagingDevices.filter(d => d.logicalVolumes?.find(l => l.filesystem?.mountPath !== undefined));

  const items = installationDevices.concat(lvmVgs);

  // Move to a helper
  const childrenFromPartitionTable = ({ partitionTable }) => {
    const { partitions, unusedSlots } = partitionTable;
    const children = partitions.concat(unusedSlots);

    return children.sort((a, b) => a.start < b.start ? -1 : 1);
  };

  // Move to a helper
  const childrenFromLvmVg = (vg) => {
    return vg.logicalVolumes.sort((a, b) => a.name < b.name ? -1 : 1);
  };

  const childrenFor = (device) => {
    if (device.partitionTable) return childrenFromPartitionTable(device);
    if (device.type === "lvmVg") return childrenFromLvmVg(device);
    return [];
  };

  const renderNewLabel = (device) => {
    if (!device.sid) return;
    if (systemDevices.find(d => d.sid === device.sid)) return;

    return (
      <Tag variant="teal">{_("New")}</Tag>
    );
  };

  const renderDeviceName = (item) => {
    return (
      <div className="split">
        <span>{item.sid && item.name}</span>
      </div>
    );
  };

  const renderFilesystemLabel = (item) => {
    const label = item.filesystem?.label;
    if (label) return <Tag variant="gray-highlight"><b>{label}</b></Tag>;
  };

  const renderDetails = (item) => {
    const description = item.sid ? item.description : _("Unused space");

    return (
      <>
        <div>{ renderNewLabel(item) }</div>
        <div>{description} {renderFilesystemLabel(item)}</div>
      </>
    );
  };

  const renderShrankLabel = (item) => {
    console.log(item.size);
    if (item.size < 5456126208) return;

    return <Tag variant="orange">{_("Shrank")}</Tag>;
  };

  const renderSize = (item) => {
    return (
      <div className="split">
        { renderShrankLabel(item) }
        { deviceSize(item.size) }
      </div>
    );
  };

  const renderMountPoint = (item) => item.sid && <em>{item.filesystem?.mountPath}</em>;

  return (
    <TreeTable
      columns={[
        { title: _("Device"), content: renderDeviceName },
        { title: _("Mount Point"), content: renderMountPoint },
        { title: _("Details"), content: renderDetails, classNames: "details-column" },
        { title: _("Size"), content: renderSize, classNames: "sizes-column" }
      ]}
      items={items}
      itemChildren={childrenFor}
      rowClassNames={(item) => {
        if (!item.sid) return "dimmed-row";
      }}
      className="proposal-result"
    />
  );
};

/**
 * Section holding the proposal result and actions to perform in the system
 * @component
 *
 * @param {object} props
 * @param {object[]} [props.actions=[]]
 * @param {object[]} [props.settings=[]]
 * @param {object[]} [props.devices=[]]
 * @param {import("~/client/mixins").ValidationError[]} props.errors - Validation errors
 * @param {boolean} [props.isLoading=false] - Whether the section content should be rendered as loading
 */
export default function ProposalResultSection({
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
      // TRANSLATORS: The storage "Result" section's title
      title={_("Result")}
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
            <Warning deleteActions={deleteActions(actions)} />
            <DevicesTreeTable settings={settings} devices={devices} />
          </>
        }
      />
    </Section>
  );
}
