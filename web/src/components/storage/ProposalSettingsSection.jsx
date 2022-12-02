/*
 * Copyright (c) [2022] SUSE LLC
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
import { Label, List, ListItem } from '@patternfly/react-core';
import { Section, Popup } from "@components/core";
import { ProposalSettingsForm } from "@components/storage";

export default function ProposalSettingsSection({ proposal, calculateProposal }) {
  const [isOpen, setIsOpen] = useState(false);

  const onSettingsChange = ({ lvm, encryptionPassword }) => {
    setIsOpen(false);
    calculateProposal({ lvm, encryptionPassword });
  };

  const ProposalDescription = () => {
    let settingsText = "Create file systems over";
    if (proposal.encryptionPassword.length > 0) settingsText += " encrypted";
    settingsText += proposal.lvm ? " LVM volumes" : " partitions";

    return (
      <List>
        <ListItem>{settingsText}</ListItem>
        <ListItem className="volumes-list">
          Create the following file systems: {proposal.volumes.map(v => (
            <Label key={v.mountPoint} isCompact>
              {v.mountPoint}
            </Label>
          ))}
        </ListItem>
      </List>
    );
  };

  return (
    <Section
      title="Settings"
      onActionClick={() => setIsOpen(true)}
      usingSeparator
    >
      <Popup title="Settings" isOpen={isOpen}>
        <ProposalSettingsForm id="settings-form" proposal={proposal} onSubmit={onSettingsChange} />
        <Popup.Actions>
          <Popup.Confirm form="settings-form" type="submit">Accept</Popup.Confirm>
          <Popup.Cancel onClick={() => setIsOpen(false)} autoFocus />
        </Popup.Actions>
      </Popup>
      <ProposalDescription />
    </Section>
  );
}
