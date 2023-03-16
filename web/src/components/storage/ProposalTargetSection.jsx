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
import { useNavigate } from "react-router-dom";
import { Button } from "@patternfly/react-core";

import { If, Popup, Section } from "~/components/core";
import { ProposalSummary, ProposalTargetForm } from "~/components/storage";

export default function ProposalTargetSection({ proposal, calculateProposal }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const onTargetChange = ({ candidateDevices }) => {
    setIsOpen(false);
    calculateProposal({ candidateDevices });
  };

  const openDeviceSelector = () => setIsOpen(true);
  const navigateToISCSIPage = () => navigate("/storage/iscsi");

  const { availableDevices = [] } = proposal;
  const renderSelector = availableDevices.length > 0;

  const Content = () => {
    return (
      <>
        <ProposalSummary proposal={proposal} />
        <Popup aria-label="Device selection" isOpen={isOpen}>
          <ProposalTargetForm id="target-form" proposal={proposal} onSubmit={onTargetChange} />
          <Popup.Actions>
            <Popup.Confirm form="target-form" type="submit">Accept</Popup.Confirm>
            <Popup.Cancel onClick={() => setIsOpen(false)} autoFocus />
          </Popup.Actions>
        </Popup>
      </>
    );
  };

  const NoDevicesContent = () => {
    return (
      <div className="stack">
        <div className="bold">No devices found</div>
        <div>Please, configure iSCSI targets in order to find available devices for installation.</div>
        <Button variant="primary" onClick={navigateToISCSIPage}>Configure iSCSI</Button>
      </div>
    );
  };

  return (
    <Section title="Device" openDialog={renderSelector ? openDeviceSelector : null}>
      <If condition={renderSelector} then={<Content />} else={<NoDevicesContent />} />
    </Section>
  );
}
