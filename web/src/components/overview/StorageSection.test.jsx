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
import { installerRender, createCallbackMock, mockComponent } from "~/test-utils";
import { createClient } from "~/client";
import { BUSY, IDLE } from "~/client/status";
import { StorageSection } from "~/components/overview";

jest.mock("~/client");
jest.mock("~/components/core/SectionSkeleton", () => mockComponent("Loading storage"));

let status = IDLE;
let proposal = {
  availableDevices: [
    { id: "/dev/sda", label: "/dev/sda, 500 GiB" },
    { id: "/dev/sdb", label: "/dev/sdb, 650 GiB" }
  ],
  result: {
    candidateDevices: ["/dev/sda"],
    lvm: false
  }
};
let errors = [];
let onStatusChangeFn = jest.fn();

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      storage: {
        proposal: { getData: jest.fn().mockResolvedValue(proposal) },
        getStatus: jest.fn().mockResolvedValue(status),
        getValidationErrors: jest.fn().mockResolvedValue(errors),
        onStatusChange: onStatusChangeFn
      },
    };
  });
});

describe("when there is a proposal", () => {
  it("renders the proposal summary", async () => {
    installerRender(<StorageSection />);

    await screen.findByText(/Install using device/);
    await screen.findByText(/\/dev\/sda, 500 GiB/);
    await screen.findByText(/and deleting all its content/);
  });

  describe("with errors", () => {
    beforeEach(() => {
      errors = [{ message: "Cannot make a proposal" }];
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

        await waitFor(() => expect(screen.queryByText("Fake error")).not.toBeInTheDocument());
      });
    });
  });

  describe("but service status changes to busy", () => {
    it("renders the skeleton", async () => {
      const [mockFunction, callbacks] = createCallbackMock();
      onStatusChangeFn = mockFunction;

      installerRender(<StorageSection showErrors />);

      await screen.findByText(/Install using device/);

      const [onStatusChangeCb] = callbacks;
      act(() => onStatusChangeCb(BUSY));

      // FIXME: check that it was not there before
      await screen.findByText("Loading storage");
    });
  });
});

describe("when there is no proposal yet", () => {
  beforeEach(() => {
    proposal = { result: undefined };
    errors = [{ message: "Fake error" }];
  });

  it("renders the skeleton", async () => {
    installerRender(<StorageSection />);

    await screen.findByText("Loading storage");
  });

  it("does not render errors", async () => {
    installerRender(<StorageSection showErrors />);

    await waitFor(() => expect(screen.queryByText("Fake error")).not.toBeInTheDocument());
  });
});

describe("but storage service is busy", () => {
  beforeEach(() => {
    status = BUSY;
    errors = [{ message: "Fake error" }];
  });

  it("renders the skeleton", async () => {
    installerRender(<StorageSection />);

    await screen.findByText("Loading storage");
  });

  it("does not render errors", async () => {
    installerRender(<StorageSection showErrors />);

    await waitFor(() => expect(screen.queryByText("Fake error")).not.toBeInTheDocument());
  });
});
