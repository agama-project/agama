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
  Form,
} from "@patternfly/react-core";

import { DeviceSelector } from "@components/storage";

export default function ProposalTargetForm({ id, proposal, onSubmit }) {
  const [candidateDevices, setCandidateDevices] = useState(proposal.candidateDevices);

  const accept = (e) => {
    e.preventDefault();
    onSubmit({ candidateDevices });
  };

  return (
    <Form id={id} onSubmit={accept}>
      <DeviceSelector
        key={candidateDevices[0]}
        value={candidateDevices[0]}
        options={proposal.availableDevices}
        onChange={(value) => setCandidateDevices([value])}
      />
    </Form>
  );
}
