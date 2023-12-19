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
import { createCallbackMock, installerRender } from "~/test-utils";
import { createClient } from "~/client";
import { IDLE } from "~/client/status";
import { ProposalPage } from "~/components/storage";

jest.mock("~/client");
jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: () => <div>PFSkeleton</div>

  };
});
jest.mock("~/components/core/Sidebar", () => () => <div>Agama sidebar</div>);
jest.mock("~/components/storage/ProposalPageOptions", () => () => <div>ProposalPage Options</div>);

const storageMock = {
  probe: jest.fn().mockResolvedValue(0),
  proposal: {
    getAvailableDevices: jest.fn().mockResolvedValue([]),
    getProductMountPoints: jest.fn().mockResolvedValue([]),
    getResult: jest.fn().mockResolvedValue(undefined),
    defaultVolume: jest.fn(mountPath => Promise.resolve({ mountPath })),
    calculate: jest.fn().mockResolvedValue(0)
  },
  getErrors: jest.fn().mockResolvedValue([]),
  isDeprecated: jest.fn().mockResolvedValue(false),
  onDeprecate: jest.fn(),
  onStatusChange: jest.fn()
};

let storage;

beforeEach(() => {
  storage = { ...storageMock, proposal: { ...storageMock.proposal } };
  createClient.mockImplementation(() => ({ storage }));
});

it("probes storage if the storage devices are deprecated", async () => {
  storage.isDeprecated = jest.fn().mockResolvedValue(true);
  installerRender(<ProposalPage />);
  await waitFor(() => expect(storage.probe).toHaveBeenCalled());
});

it("does not probe storage if the storage devices are not deprecated", async () => {
  installerRender(<ProposalPage />);
  await waitFor(() => expect(storage.probe).not.toHaveBeenCalled());
});

it("loads the proposal data", async () => {
  storage.proposal.getResult = jest.fn().mockResolvedValue(
    { settings: { bootDevice: "/dev/vda" } }
  );

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
    storage.onDeprecate = mockFunction;

    installerRender(<ProposalPage />);

    storage.isDeprecated = jest.fn().mockResolvedValue(true);
    const [onDeprecateCb] = callbacks;
    await act(() => onDeprecateCb());

    await waitFor(() => expect(storage.probe).toHaveBeenCalled());
  });

  it("loads the proposal data", async () => {
    const result = { settings: { bootDevice: "/dev/vda" } };
    storage.proposal.getResult = jest.fn().mockResolvedValue(result);

    const [mockFunction, callbacks] = createCallbackMock();
    storage.onDeprecate = mockFunction;

    installerRender(<ProposalPage />);

    await screen.findByText("/dev/vda");

    result.settings.bootDevice = "/dev/vdb";

    const [onDeprecateCb] = callbacks;
    await act(() => onDeprecateCb());

    await screen.findByText("/dev/vdb");
  });
});

describe("when there is no proposal yet", () => {
  beforeEach(() => {
    storage.proposal.getResult = jest.fn().mockResolvedValue(undefined);
  });

  it("shows the page as loading", async () => {
    installerRender(<ProposalPage />);

    screen.getAllByText(/PFSkeleton/);
    await waitFor(() => expect(screen.queryByText(/Installation device/)).toBeNull());
  });

  it("loads the proposal when the service finishes to calculate", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    storage.onStatusChange = mockFunction;

    installerRender(<ProposalPage />);

    screen.getAllByText(/PFSkeleton/);

    storage.proposal.getResult = jest.fn().mockResolvedValue(
      { settings: { bootDevice: "/dev/vda" } }
    );

    const [onStatusChangeCb] = callbacks;
    await act(() => onStatusChangeCb(IDLE));
    await screen.findByText("/dev/vda");
  });
});

describe("when there is a proposal", () => {
  beforeEach(() => {
    storage.proposal.getResult = jest.fn().mockResolvedValue(
      { settings: { bootDevice: "/dev/vda" } }
    );
  });

  it("does not load the proposal when the service finishes to calculate", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    storage.proposal.onStatusChange = mockFunction;

    installerRender(<ProposalPage />);

    await screen.findByText("/dev/vda");

    const [onStatusChangeCb] = callbacks;
    expect(onStatusChangeCb).toBeUndefined();
  });
});
