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

import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import { installerRender, mockComponent } from "~/test-utils";
import { ProposalTargetSection } from "~/components/storage";

const FakeProposalTargetForm = ({ id, onSubmit }) => {
  const accept = (e) => {
    e.preventDefault();
    onSubmit({});
  };

  return <form id={id} onSubmit={accept} aria-label="Target form" />;
};

jest.mock("~/components/storage/ProposalSummary", () => mockComponent("Proposal summary"));
jest.mock("~/components/storage/ProposalTargetForm", () => FakeProposalTargetForm);

let proposal;

describe("when there are candidate devices available", () => {
  beforeEach(() => {
    proposal = {
      availableDevices: [{ id: "/dev/sda", label: "/dev/sda, 500 GiB" }],
      result : {
        candidateDevices: ["/dev/sda"],
        lvm: false
      }
    };
  });

  it("renders the proposal summary", () => {
    installerRender(<ProposalTargetSection proposal={proposal} />);

    screen.getByText("Proposal summary");
  });

  it("does not show the device selector by default", async () => {
    installerRender(<ProposalTargetSection proposal={proposal} />);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("allows changing the device selection", async () => {
    const calculateFn = jest.fn();

    const { user } = installerRender(<ProposalTargetSection proposal={proposal} calculateProposal={calculateFn} />);

    const button = screen.getByRole("button", { name: "Device" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    const accept = within(popup).getByRole("button", { name: "Accept" });
    await user.click(accept);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calculateFn).toHaveBeenCalled();
  });

  it("allows aborting the candidate selection", async () => {
    const calculateFn = jest.fn();

    const { user } = installerRender(<ProposalTargetSection proposal={proposal} calculateProposal={calculateFn} />);

    const button = screen.getByRole("button", { name: "Device" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    const cancel = within(popup).getByRole("button", { name: "Cancel" });
    await user.click(cancel);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calculateFn).not.toHaveBeenCalled();
  });
});

describe("when there are no candidate devices available", () => {
  beforeEach(() => {
    proposal = {
      result: {
        candidateDevices: []
      },
      availableDevices: []
    };
  });

  it("renders an informative message", () => {
    installerRender(<ProposalTargetSection proposal={proposal} />);

    screen.getByText("No devices found");
  });

  it("does not allow configuring the candidate devices", () => {
    installerRender(<ProposalTargetSection proposal={proposal} />);

    const actionButton = screen.queryByRole("button", { name: "Device" });
    expect(actionButton).toBeNull();
  });
});
