/*
 * Copyright (c) [2023] SUSE LLC
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

import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { ProposalSummary } from "~/components/storage";

describe("ProposalSummary", () => {
  describe("when there are no availableDevices", () => {
    it("renders nothing", async () => {
      const { container } = installerRender(<ProposalSummary proposal={{}} />);

      await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
  });

  describe("when the proposal is not calculated", () => {
    it("renders a devices not selected message", async () => {
      const proposal = {
        result: undefined,
        availableDevices: [{ id: "sda", label: "/dev/sda" }]
      };

      installerRender(<ProposalSummary proposal={proposal} />);

      screen.getByText("Device not selected yet");
    });
  });

  describe("when the proposal is calculated", () => {
    let proposal;

    beforeEach(() => {
      proposal = {
        result: {
          candidateDevices: ["sdb"]
        },
        availableDevices: [
          { id: "sda", label: "/dev/sda 300 MiB" },
          { id: "sdb", label: "/dev/sdb 5 GiB" },
        ]
      };
    });

    it("renders the candidate device label", () => {
      installerRender(
        <ProposalSummary proposal={proposal} />
      );

      screen.getByText("/dev/sdb 5 GiB");
    });

    describe("and the candidate device is missing", () => {
      beforeEach(() => {
        proposal.result.candidateDevices = ["sdc"];
      });

      it("renders the candidate device name", () => {
        installerRender(
          <ProposalSummary proposal={proposal} />
        );

        screen.getByText("sdc");
      });
    });
  });
});
