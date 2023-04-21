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
import { act, screen, waitFor } from "@testing-library/react";
import { createCallbackMock, installerRender, mockComponent } from "~/test-utils";
import { createClient } from "~/client";
import { ProposalPage } from "~/components/storage";

jest.mock("~/client");
jest.mock("~/components/storage/ProposalPageOptions", () => mockComponent("ProposalPage Options"));

jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: mockComponent("PFSkeleton")
  };
});

const defaultProposalData = {
  availableDevices: [],
  volumeTemplates: [],
  result: {
    candidateDevices: ["/dev/vda"],
    lvm: false,
    encryptionPassword: "",
    volumes: []
  }
};

let proposalData;

const probeFn = jest.fn().mockResolvedValue(0);

const isDeprecatedFn = jest.fn();

let onDeprecateFn = jest.fn();

beforeEach(() => {
  isDeprecatedFn.mockResolvedValue(false);

  proposalData = defaultProposalData;

  createClient.mockImplementation(() => {
    return {
      storage: {
        probe: probeFn,
        proposal: {
          getData: jest.fn().mockResolvedValue(proposalData),
          calculate: jest.fn().mockResolvedValue(0)
        },
        getValidationErrors: jest.fn().mockResolvedValue([]),
        isDeprecated: isDeprecatedFn,
        onDeprecate: onDeprecateFn
      }
    };
  });
});

it("probes storage if the storage devices are deprecated", async () => {
  isDeprecatedFn.mockResolvedValue(true);
  installerRender(<ProposalPage />);
  await waitFor(() => expect(probeFn).toHaveBeenCalled());
});

it("does not probe storage if the storage devices are not deprecated", async () => {
  installerRender(<ProposalPage />);
  await waitFor(() => expect(probeFn).not.toHaveBeenCalled());
});

it("loads the proposal data", async () => {
  installerRender(<ProposalPage />);

  screen.getAllByText(/PFSkeleton/);
  expect(screen.queryByText(/Installation device/)).toBeNull();
  await screen.findByText(/Installation device/);
  screen.getByText("/dev/vda");
});

it("renders a warning about modified devices", async () => {
  installerRender(<ProposalPage />);

  await screen.findByText(/Devices will not be modified/);
});

it("renders the settings and actions sections", async () => {
  installerRender(<ProposalPage />);

  await screen.findByText(/Settings/);
  await screen.findByText(/Planned Actions/);
});

describe("when the storage devices become deprecated", () => {
  it("probes storage", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    onDeprecateFn = mockFunction;
    installerRender(<ProposalPage />);

    isDeprecatedFn.mockResolvedValue(true);
    const [onDeprecateCb] = callbacks;
    await act(() => onDeprecateCb());

    await waitFor(() => expect(probeFn).toHaveBeenCalled());
  });

  it("loads the proposal data", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    onDeprecateFn = mockFunction;
    installerRender(<ProposalPage />);

    await screen.findByText("/dev/vda");

    proposalData.result.candidateDevices = ["/dev/vdb"];

    const [onDeprecateCb] = callbacks;
    await act(() => onDeprecateCb());

    await screen.findByText("/dev/vdb");
  });
});
