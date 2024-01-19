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
import { installerRender, createCallbackMock } from "~/test-utils";
import { noop } from "~/utils";
import { createClient } from "~/client";
import { BUSY, IDLE } from "~/client/status";
import { StorageSection } from "~/components/overview";

jest.mock("~/client");
jest.mock("~/components/core/SectionSkeleton", () => () => <div>Loading storage</div>);

const availableDevices = [
  { name: "/dev/sda", size: 536870912000 },
  { name: "/dev/sdb", size: 697932185600 }
];

const encryptionMethods = ["luks2", "tpm_fde"];

const proposalResult = {
  settings: {
    bootDevice: "/dev/sda",
    lvm: false,
    spacePolicy: "delete"
  },
  actions: []
};

const storageMock = {
  probe: jest.fn().mockResolvedValue(0),
  proposal: {
    getAvailableDevices: jest.fn().mockResolvedValue(availableDevices),
    getEncryptionMethods: jest.fn().mockResolvedValue(encryptionMethods),
    getResult: jest.fn().mockResolvedValue(proposalResult),
    calculate: jest.fn().mockResolvedValue(0)
  },
  getStatus: jest.fn().mockResolvedValue(IDLE),
  getProgress: jest.fn().mockResolvedValue({
    message: "Activating storage devices", current: 1, total: 4
  }),
  onProgressChange: noop,
  getErrors: jest.fn().mockResolvedValue([]),
  onStatusChange: jest.fn(),
  isDeprecated: jest.fn().mockResolvedValue(false),
  onDeprecate: noop
};

let storage;

beforeEach(() => {
  storage = { ...storageMock, proposal: { ...storageMock.proposal } };

  createClient.mockImplementation(() => ({ storage }));
});

it("probes storage if the storage devices are deprecated", async () => {
  storage.isDeprecated = jest.fn().mockResolvedValue(true);
  installerRender(<StorageSection />);
  await waitFor(() => expect(storage.probe).toHaveBeenCalled());
});

it("does not probe storage if the storage devices are not deprecated", async () => {
  installerRender(<StorageSection />);
  await waitFor(() => expect(storage.probe).not.toHaveBeenCalled());
});

describe("when there is a proposal", () => {
  it("renders the proposal summary", async () => {
    installerRender(<StorageSection />);

    await screen.findByText(/Install using device/);
    await screen.findByText(/\/dev\/sda, 500 GiB/);
    await screen.findByText(/and deleting all its content/);
  });

  describe("and the space policy is set to 'resize'", () => {
    beforeEach(() => {
      const result = { settings: { spacePolicy: "resize", bootDevice: "/dev/sda" } };
      storage.proposal.getResult = jest.fn().mockResolvedValue(result);
    });

    it("indicates that partitions may be shrunk", async () => {
      installerRender(<StorageSection />);

      await screen.findByText(/shrinking existing partitions as needed/);
    });
  });

  describe("and the space policy is set to 'keep'", () => {
    beforeEach(() => {
      const result = { settings: { spacePolicy: "keep", bootDevice: "/dev/sda" } };
      storage.proposal.getResult = jest.fn().mockResolvedValue(result);
    });

    it("indicates that partitions will be kept", async () => {
      installerRender(<StorageSection />);

      await screen.findByText(/without modifying existing partitions/);
    });
  });

  describe("and there is no boot device", () => {
    beforeEach(() => {
      const result = { settings: { bootDevice: "" } };
      storage.proposal.getResult = jest.fn().mockResolvedValue(result);
    });

    it("indicates that a device is not selected", async () => {
      installerRender(<StorageSection />);

      await screen.findByText(/No device selected/);
    });
  });

  describe("with errors", () => {
    beforeEach(() => {
      const errors = [{ description: "Cannot make a proposal" }];
      storage.getErrors = jest.fn().mockResolvedValue(errors);
    });

    describe("and component has received the showErrors prop", () => {
      it("renders errors", async () => {
        installerRender(<StorageSection showErrors />);

        await screen.findByText("Cannot make a proposal");
      });
    });

    describe("but component does not receive the showErrors prop", () => {
      it("does not render errors", async () => {
        installerRender(<StorageSection />);

        await waitFor(() => {
          expect(screen.queryByText("Cannot make a proposal")).not.toBeInTheDocument();
        });
      });
    });
  });

  describe("and service status changes to busy", () => {
    it("renders the progress", async () => {
      const [mockFunction, callbacks] = createCallbackMock();
      storage.onStatusChange = mockFunction;

      installerRender(<StorageSection showErrors />);

      await screen.findByText(/Install using device/);

      const [onStatusChangeCb] = callbacks;
      act(() => onStatusChangeCb(BUSY));

      // FIXME: check that it was not there before
      await screen.findByText("Probing storage devices");
    });
  });
});

describe("when there is no proposal yet", () => {
  beforeEach(() => {
    storage.proposal.getResult = jest.fn().mockResolvedValue(undefined);
    const errors = [{ description: "Fake error" }];
    storage.getErrors = jest.fn().mockResolvedValue(errors);
  });

  it("renders the progress", async () => {
    installerRender(<StorageSection />);

    await screen.findByText("Probing storage devices");
  });

  it("does not render errors", async () => {
    installerRender(<StorageSection showErrors />);

    await waitFor(() => expect(screen.queryByText("Fake error")).not.toBeInTheDocument());
  });
});

describe("when storage service is busy", () => {
  beforeEach(() => {
    storage.getStatus = jest.fn().mockResolvedValue(BUSY);
    const errors = [{ description: "Fake error" }];
    storage.getErrors = jest.fn().mockResolvedValue(errors);
  });

  it("renders the progress", async () => {
    installerRender(<StorageSection />);

    await screen.findByText("Activating storage devices (1/4)");
  });

  it("does not render errors", async () => {
    installerRender(<StorageSection showErrors />);

    await waitFor(() => expect(screen.queryByText("Fake error")).not.toBeInTheDocument());
  });
});

describe("when the storage devices become deprecated", () => {
  it("probes storage", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    storage.onDeprecate = mockFunction;

    installerRender(<StorageSection />);

    const [onDeprecateCb] = callbacks;
    await act(() => onDeprecateCb());

    await waitFor(() => expect(storage.probe).toHaveBeenCalled());
  });
});
