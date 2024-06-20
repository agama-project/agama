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

import React from "react";

import { act, screen } from "@testing-library/react";
import { installerRender, createCallbackMock } from "~/test-utils";
import { createClient } from "~/client";

import { ProgressReport } from "~/components/core";

jest.mock("~/client");

let callbacks;
let onManagerProgressChange = jest.fn();
let onSoftwareProgressChange = jest.fn();
let onStorageProgressChange = jest.fn();

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      manager: {
        onProgressChange: onManagerProgressChange,
        getProgress: jest.fn().mockResolvedValue({
          message: "Partition disks",
          current: 1,
          total: 10,
          steps: ["Partition disks", "Install software"],
        }),
      },
      software: {
        onProgressChange: onSoftwareProgressChange,
      },
      storage: {
        onProgressChange: onStorageProgressChange,
      },
    };
  });
});

describe("ProgressReport", () => {
  describe("when there is progress information available", () => {
    beforeEach(() => {
      const [onManagerProgress, managerCallbacks] = createCallbackMock();
      const [onSoftwareProgress, softwareCallbacks] = createCallbackMock();
      const [onStorageProgress, storageCallbacks] = createCallbackMock();
      onManagerProgressChange = onManagerProgress;
      onSoftwareProgressChange = onSoftwareProgress;
      onStorageProgressChange = onStorageProgress;
      callbacks = {
        manager: managerCallbacks,
        software: softwareCallbacks,
        storage: storageCallbacks,
      };
    });

    it("shows the progress including the details from the storage service", async () => {
      installerRender(<ProgressReport />);

      await screen.findByText(/Waiting/i);
      await screen.findByText(/Partition disks/i);
      await screen.findByText(/Install software/i);

      const cb = callbacks.storage[callbacks.storage.length - 1];
      act(() => {
        cb({
          message: "Doing some partitioning",
          current: 1,
          total: 10,
          finished: false,
        });
      });

      await screen.findByText("Doing some partitioning (1/10)");
    });

    it("shows the progress including the details from the software service", async () => {
      installerRender(<ProgressReport />);

      await screen.findByText(/Waiting/i);
      await screen.findByText(/Install software/i);

      const cb = callbacks.software[callbacks.software.length - 1];
      act(() => {
        cb({
          message: "Installing packages",
          current: 495,
          total: 500,
          finished: false,
        });
      });

      await screen.findByText("Installing packages (495/500)");
    });
  });
});
