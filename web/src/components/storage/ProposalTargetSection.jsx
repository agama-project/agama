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

import {
  Button,
  Text
} from "@patternfly/react-core";

import {
  EOS_VOLUME as SectionIcon,
  EOS_SETTINGS as EditIcon
} from "eos-icons-react";

import { Section, Popup } from "@components/core";
import { ProposalTargetForm } from "@components/storage";

export default function ProposalTargetSection({ proposal, calculateProposal }) {
  const [isOpen, setIsOpen] = useState(false);

  const calculate = ({ candidateDevices }) => {
    calculateProposal({ candidateDevices });
  };

  return (
    <Section title="Target" icon={SectionIcon}>
      <Button
        isSmall
        variant="plain"
        icon={<EditIcon />}
        aria-label="Change target"
        onClick={() => setIsOpen(true)}
      />
      <Text>
        Install using disk {proposal.candidateDevices.join(", ")} and deleting all its content
      </Text>
      <Popup title="Device selection" isOpen={isOpen}>
        <ProposalTargetForm id="target-form" proposal={proposal} onSubmit={calculate} />
        <Popup.Actions>
          <Popup.Confirm form="target-form" type="submit">Accept</Popup.Confirm>
          <Popup.Cancel onClick={() => setIsOpen(false)} autoFocus />
        </Popup.Actions>
      </Popup>
    </Section>
  );
}
