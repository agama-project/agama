/*
 * Copyright (c) [2023-2024] SUSE LLC
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

import React, { useEffect, useState } from "react";
import { useHref } from "react-router-dom";
import {
  MenuToggle,
  Select, SelectList, SelectOption
} from "@patternfly/react-core";
import { _ } from "~/i18n";
import { useInstallerClient } from "~/context/installer";

/**
 * Internal component for building the link to Storage/DASD page
 * @component
 */
const DASDLink = () => {
  const href = useHref("/storage/dasd");

  return (
    <SelectOption
      key="dasd-link"
      to={href}
      description={_("Manage and format")}
    >
      DASD
    </SelectOption>
  );
};

/**
 * Internal component for building the link to Storage/zFCP page
 * @component
 */
const ZFCPLink = () => {
  const href = useHref("/storage/zfcp");

  return (
    <SelectOption
      key="zfcp-link"
      to={href}
      description={_("Activate disks")}
    >
      {_("zFCP")}
    </SelectOption>
  );
};

/**
 * Internal component for building the link to Storage/iSCSI page
 * @component
 */
const ISCSILink = () => {
  const href = useHref("/storage/iscsi");

  return (
    <SelectOption
      key="iscsi-link"
      to={href}
      description={_("Connect to iSCSI targets")}
    >
      {_("iSCSI")}
    </SelectOption>
  );
};

/**
 * Component for rendering the options available from Storage/ProposalPage
 * @component
 *
 * @typedef {object} ProposalMenuProps
 * @property {string} label
 *
 * @param {ProposalMenuProps} props
 */
export default function DevicesTechMenu({ label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDasdLink, setShowDasdLink] = useState(false);
  const [showZFCPLink, setShowZFCPLink] = useState(false);
  const { storage: client } = useInstallerClient();

  useEffect(() => {
    client.dasd.isSupported().then(setShowDasdLink);
    client.zfcp.isSupported().then(setShowZFCPLink);
  }, [client.dasd, client.zfcp]);

  const toggle = toggleRef => (
    <MenuToggle ref={toggleRef} onClick={() => setIsOpen(!isOpen)} isExpanded={isOpen}>
      {label}
    </MenuToggle>
  );

  const onSelect = (_event, value) => {
    setIsOpen(false);
  };

  return (
    <Select
      id="storage-tech-menu"
      isScrollable
      isOpen={isOpen}
      onSelect={onSelect}
      onOpenChange={(isOpen) => setIsOpen(isOpen)}
      toggle={toggle}
    >
      <SelectList>
        {showDasdLink && <DASDLink />}
        <ISCSILink />
        {showZFCPLink && <ZFCPLink />}
      </SelectList>
    </Select>
  );
}
