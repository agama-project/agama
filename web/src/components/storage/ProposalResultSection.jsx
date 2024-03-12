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

import React, { useState } from "react";
import { Alert, Button, Skeleton } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { compact, uniq } from "~/utils";
import { deviceSize } from "~/components/storage/utils";
import DevicesManager from "~/components/storage/DevicesManager";
import { If, Section, Tag, TreeTable } from "~/components/core";
import { ProposalActionsDialog } from "~/components/storage";

/**
 * Returns the delete actions from given list
 *
 * @param {object[]} actions
 * @param {object} devicesManager
 * @returns {string[]}
 */
const deleteActions = (actions, devicesManager) => {
  const actionText = (action) => {
    const device = devicesManager.systemDevice(action.device);

    if (device && device.systems.length > 0)
      return sprintf(_("%s <strong>which contains %s</strong>"), action.text, device.systems.join(", "));

    return action.text;
  };

  return actions.filter(a => a.delete).map(actionText);
};

/**
 * Renders a warning alert if there are delete actions
 *
 * @param {object} props
 * @param {string[]} props.content
 */
const Warning = ({ content }) => {
  const count = content.length;

  if (count === 0) return;

  const title = sprintf(_("%s delete actions will be performed"), count);

  return (
    <Alert isInline variant="warning" title={title}>
      <ul>
        { content.map((action, i) => <li key={i} dangerouslySetInnerHTML={{ __html: action }} />) }
      </ul>
    </Alert>
  );
};

/**
 * Renders needed UI elements to allow users check all planned actions
 *
 * @param {object} props
 * @param {object[]} props.actions
 */
const ActionsInfo = ({ actions }) => {
  const [showActions, setShowActions] = useState(false);

  const onOpen = () => setShowActions(true);
  const onClose = () => setShowActions(false);

  return (
    <>
      <p className="split">
        <Button onClick={onOpen} variant="link" className="plain-button">{_("Check all planned actions")}</Button>
        {_("to create these file systems and to ensure the new system boots.")}
      </p>
      <ProposalActionsDialog actions={actions} isOpen={showActions} onClose={onClose} />
    </>
  );
};

/**
 * Renders a TreeTable rendering the devices proposal result
 *
 * FIXME: add expected types
 *
 * @param {object} props
 * @param {object[]} props.devices
 * @param {object} props.devicesManager
 */
const DevicesTreeTable = ({ devices, devicesManager }) => {
  const renderDeviceName = (item) => {
    let name = item.sid && item.name;
    // NOTE: returning a fragment here to avoid a weird React complaint when using a PF/Table +
    // treeRow props.
    if (!name) return <></>;

    if (["partition", "lvmLv"].includes(item.type))
      name = name.split("/").pop();

    return (
      <div className="split">
        <span>{name}</span>
      </div>
    );
  };

  const renderNewLabel = (item) => {
    if (!item.sid) return;

    // FIXME New PVs over a disk is not detected as new.
    if (!devicesManager.existInSystem(item) || devicesManager.hasNewFilesystem(item))
      return <Tag variant="teal">{_("New")}</Tag>;
  };

  const renderContent = (item) => {
    if (!item.sid)
      return _("Unused space");
    if (!item.partitionTable && item.systems?.length > 0)
      return item.systems.join(", ");

    return item.description;
  };

  const renderFilesystemLabel = (item) => {
    const label = item.filesystem?.label;
    if (label) return <Tag variant="gray-highlight"><b>{label}</b></Tag>;
  };

  const renderPTableType = (item) => {
    // TODO: Create a map for partition table types and use an <abbr/> here.
    const type = item.partitionTable?.type;
    if (type) return <Tag><b>{type.toUpperCase()}</b></Tag>;
  };

  const renderDetails = (item) => {
    return (
      <>
        <div>{renderNewLabel(item)}</div>
        <div>{renderContent(item)} {renderFilesystemLabel(item)} {renderPTableType(item)}</div>
      </>
    );
  };

  const renderResizedLabel = (item) => {
    if (!item.sid || !devicesManager.isResized(item)) return;

    return (
      <Tag variant="orange">
        {sprintf(_("Resized %s"), deviceSize(devicesManager.resizeSize(item)))}
      </Tag>
    );
  };

  const renderSize = (item) => {
    return (
      <div className="split">
        {renderResizedLabel(item)}
        {deviceSize(item.size)}
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
      items={devices}
      itemChildren={d => devicesManager.children(d)}
      rowClassNames={(item) => {
        if (!item.sid) return "dimmed-row";
      }}
      className="proposal-result"
    />
  );
};

/**
 * @todo Create a component for rendering a customized skeleton
 */
const ResultSkeleton = () => {
  return (
    <>
      <Skeleton width="80%" />
      <Skeleton width="65%" />
      <Skeleton width="70%" />
    </>
  );
};

const SectionContent = ({ actions, devices, errors }) => {
  if (errors.length) return;

  const { system = [], staging = [] } = devices;
  const devicesManager = new DevicesManager(system, staging);

  const isUsed = (device) => {
    const actionDevices = uniq(compact(actions.map(a => a.device)));

    return actionDevices.includes(device.sid) ||
      devicesManager.children(device).find(c => isUsed(c));
  };

  const usedDevices = () => {
    return staging
      .filter(d => d.isDrive || d.type === "lvmVg")
      .filter(d => isUsed(d) || isUsed(devicesManager.systemDevice(d.sid)));
  };

  return (
    <>
      <Warning content={deleteActions(actions, devicesManager)} />
      <DevicesTreeTable devices={usedDevices()} devicesManager={devicesManager} />
      <ActionsInfo actions={actions} />
    </>
  );
};

/**
 * Section holding the proposal result and actions to perform in the system
 * @component
 *
 * FIXME: add expected types
 *
 * @param {object} props
 * @param {object[]} [props.actions=[]]
 * @param {object[]} [props.settings=[]]
 * @param {object} [props.devices={}]
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

  return (
    <Section
      // TRANSLATORS: The storage "Result" section's title
      title={_("Result")}
      // TRANSLATORS: The storage "Result" section's description
      description={_("How the system will look after installing with current proposal.")}
      id="storage-result"
      errors={errors}
    >
      <If
        condition={isLoading}
        then={<ResultSkeleton />}
        else={
          <SectionContent
            actions={actions}
            settings={settings}
            devices={devices}
            errors={errors}
          />
        }
      />
    </Section>
  );
}
