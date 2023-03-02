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

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      manager: {
        onProgressChange: onManagerProgressChange,
        getProgress: jest.fn().mockResolvedValue(
          { message: "Reading repositories", current: 1, total: 10 }
        )
      },
      software: {
        onProgressChange: onSoftwareProgressChange
      }
    };
  });
});

describe("ProgressReport", () => {
  describe("when there is not progress information available", () => {
    it.skip("renders a waiting message", () => {
      installerRender(<ProgressReport />);

      expect(screen.findByText(/Waiting for/i)).toBeInTheDocument();
    });
  });

  describe("when there is progress information available", () => {
    beforeEach(() => {
      const [onManagerProgress, managerCallbacks] = createCallbackMock();
      const [onSoftwareProgress, softwareCallbacks] = createCallbackMock();
      onManagerProgressChange = onManagerProgress;
      onSoftwareProgressChange = onSoftwareProgress;
      callbacks = { manager: managerCallbacks, software: softwareCallbacks };
    });

    it("shows the main progress bar", async () => {
      installerRender(<ProgressReport />);

      await screen.findByText(/Waiting/i);
      await screen.findByText(/Reading/i);

      // NOTE: there can be more than one subscriptions to the
      // manager#onProgressChange. We're interested in the latest one here.
      const cb = callbacks.manager[callbacks.manager.length - 1];
      act(() => {
        cb({ message: "Partitioning", current: 1, total: 10 });
      });

      await screen.findByLabelText("Partitioning");
    });

    it("does not show secondary progress bar", async () => {
      installerRender(<ProgressReport />);

      await screen.findByText(/Waiting/i);

      const cb = callbacks.manager[callbacks.manager.length - 1];
      act(() => {
        cb({ message: "Partitioning", current: 1, total: 10 });
      });

      await screen.findAllByRole("progressbar", { hidden: true });
    });

    describe("when there is progress information from the software service", () => {
      it("shows the secondary progress bar", async () => {
        installerRender(<ProgressReport />);

        await screen.findByText(/Waiting/i);

        // NOTE: there can be more than one subscriptions to the
        // manager#onChange. We're interested in the latest one here.
        const cb0 = callbacks.manager[callbacks.manager.length - 1];
        act(() => {
          cb0({ message: "Installing software", current: 4, total: 10 });
        });

        const cb1 = callbacks.software[callbacks.software.length - 1];
        act(() => {
          cb1({ message: "Installing YaST2", current: 256, total: 500, finished: false });
        });

        const bars = screen.queryAllByRole("progressbar", { hidden: false });
        expect(bars.length).toEqual(2);
      });
    });
  });
});
