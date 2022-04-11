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
import { authRender } from "./test-utils";
import { createClient } from "./client";

import ProgressReport from "./ProgressReport";

jest.mock("./client");

let callbacks;
let onChangeFn = jest.fn();

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      manager: {
        onChange: onChangeFn
      }
    };
  });
});

describe("ProbingProgress", () => {
  // TODO: complete testing where the substep bar must be shown

  describe("when there is not progress information available", () => {
    it("renders a waiting message", async () => {
      authRender(<ProgressReport />);

      await screen.findByText(/Waiting for/i);
    });

    it("does not show progress bars", async () => {
      authRender(<ProgressReport />);

      const mainProgressBar = await screen.queryByLabelText("Main progress bar");
      expect(mainProgressBar).toBeNull();
    });
  });

  describe("when there is progress information available", () => {
    beforeEach(() => {
      callbacks = [];
      onChangeFn = cb => callbacks.push(cb);
    });

    describe("without substeps", () => {
      it("shows main progress bar", async () => {
        authRender(<ProgressReport />);

        await screen.findByText(/Waiting/i);

        // NOTE: there can be more than one susbcriptions to the
        // manager#onChange. We're insterested in the latest one here.
        const cb = callbacks[callbacks.length - 1];
        act(() => {
          cb({ Progress: ["Mock progress", 2, 1, 0, 0] });
        });

        await screen.findByLabelText("Main progress bar");
      });

      it("does not show secondary progress bar", async () => {
        authRender(<ProgressReport />);

        await screen.findByText(/Waiting/i);

        // NOTE: there can be more than one susbcriptions to the
        // manager#onChange. We're insterested in the latest one here.
        const cb = callbacks[callbacks.length - 1];
        act(() => {
          cb({ Progress: ["Mock progress", 2, 1, 0, 0] });
        });

        const secondaryProgressBar = await screen.queryByLabelText("Secondary progress bar");
        expect(secondaryProgressBar).toBeNull();
      });
    });

    describe("with substeps", () => {
      it("shows main progress bar", async () => {
        authRender(<ProgressReport />);

        await screen.findByText(/Waiting/i);

        // NOTE: there can be more than one susbcriptions to the
        // manager#onChange. We're insterested in the latest one here.
        const cb = callbacks[callbacks.length - 1];
        act(() => {
          cb({ Progress: ["Mock progress", 2, 1, 4, 2] });
        });

        await screen.findByLabelText("Main progress bar");
      });

      it("shows secondary progress bar", async () => {
        authRender(<ProgressReport />);

        await screen.findByText(/Waiting/i);

        // NOTE: there can be more than one susbcriptions to the
        // manager#onChange. We're insterested in the latest one here.
        const cb = callbacks[callbacks.length - 1];
        act(() => {
          cb({ Progress: ["Mock progress", 2, 1, 4, 2] });
        });

        await screen.findByLabelText("Secondary progress bar");
      });
    });
  });
});
