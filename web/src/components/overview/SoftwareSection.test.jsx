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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { noop } from "~/utils";
import { createClient } from "~/client";
import { BUSY, IDLE } from "~/client/status";
import { SoftwareSection } from "~/components/overview";

jest.mock("~/client");

const kdePattern = {
  name: "kde",
  category: "Graphical Environments",
  icon: "./pattern-kde",
  description: "Packages providing the Plasma desktop environment and applications from KDE.",
  summary: "KDE Applications and Plasma Desktop",
  order: "1110",
};

let getStatusFn = jest.fn().mockResolvedValue(IDLE);
let getProgressFn = jest.fn().mockResolvedValue({});
let getIssuesFn = jest.fn().mockResolvedValue([]);

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      onConnect: jest.fn(),
      onDisconnect: jest.fn(),
      software: {
        getStatus: getStatusFn,
        getProgress: getProgressFn,
        getIssues: getIssuesFn,
        onStatusChange: noop,
        onProgressChange: noop,
        getProposal: jest.fn().mockResolvedValue({ size: "500 MiB" }),
      },
    };
  });
});

describe("when the proposal is calculated", () => {
  beforeEach(() => {
    getStatusFn = jest.fn().mockResolvedValue(IDLE);
  });

  it("renders the required space", async () => {
    installerRender(<SoftwareSection showErrors />);
    await screen.findByText("Installation will take");
    await screen.findByText("500 MiB");
  });

  describe("and there are errors", () => {
    beforeEach(() => {
      getIssuesFn = jest.fn().mockResolvedValue([{ description: "Could not install..." }]);
    });

    it("renders a button to refresh the repositories", async () => {
      installerRender(<SoftwareSection showErrors />);
      await screen.findByRole("button", { name: /Refresh/ });
    });
  });
});

describe("when the proposal is being calculated", () => {
  beforeEach(() => {
    getStatusFn = jest.fn().mockResolvedValue(BUSY);
    getProgressFn = jest.fn().mockResolvedValue(
      { message: "Initializing target repositories", current: 1, total: 4, finished: false },
    );
  });

  it("just displays the progress", async () => {
    installerRender(<SoftwareSection showErrors />);
    await screen.findByText("Initializing target repositories (1/4)");
    expect(screen.queryByText(/Installation will take/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Refresh/ })).not.toBeInTheDocument();
  });
});
