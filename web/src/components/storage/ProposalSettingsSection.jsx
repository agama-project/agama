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
import { List, ListItem } from '@patternfly/react-core';
import { Em, Section, Popup } from "~/components/core";
import { ProposalSettingsForm } from "~/components/storage";

export default function ProposalSettingsSection({ proposal, calculateProposal }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isValid, setIsValid] = useState(true);

  const onSettingsChange = ({ lvm, encryptionPassword }) => {
    setIsOpen(false);
    calculateProposal({ lvm, encryptionPassword });
  };

  const ProposalDescription = () => {
    const settingsText = (proposal) => {
      let text = "Create file systems over";
      if (proposal.result.encryptionPassword.length > 0) text += " encrypted";
      text += proposal.result.lvm ? " LVM volumes" : " partitions";

      return text;
    };

    return (
      <List>
        <ListItem>{settingsText(proposal)}</ListItem>
        <ListItem className="volumes-list">
          Create the following file systems: {proposal.result.volumes.map(v => (
            <Em key={v.mountPoint}>{v.mountPoint}</Em>
          ))}
        </ListItem>
      </List>
    );
  };

  return (
    <Section
      title="Settings"
      onActionClick={() => setIsOpen(true)}
      hasSeparator
    >
      <Popup title="Settings" isOpen={isOpen}>
        <ProposalSettingsForm
          id="settings-form"
          proposal={proposal}
          onSubmit={onSettingsChange}
          onValidate={setIsValid}
        />
        <Popup.Actions>
          <Popup.Confirm form="settings-form" type="submit" isDisabled={!isValid}>Accept</Popup.Confirm>
          <Popup.Cancel onClick={() => setIsOpen(false)} autoFocus />
        </Popup.Actions>
      </Popup>
      <ProposalDescription />
    </Section>
  );
}
