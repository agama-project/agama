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

import { act, screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { BUSY, IDLE } from "~/client/status";
import { createClient } from "~/client";
import test_patterns from "./PatternSelector.test.json";
import SoftwarePage from "./SoftwarePage";

jest.mock("~/client");

const getStatusFn = jest.fn();
const onStatusChangeFn = jest.fn();
const onSelectedPatternsChangedFn = jest.fn();
const selectPatternsFn = jest.fn();
const proposal = {
  patterns: { yast2_basis: 1 },
  size: "1.8 GiB",
};

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      software: {
        getStatus: getStatusFn,
        onStatusChange: onStatusChangeFn,
        onSelectedPatternsChanged: onSelectedPatternsChangedFn,
        getPatterns: jest.fn().mockResolvedValue(test_patterns),
        getProposal: jest.fn().mockResolvedValue(proposal),
        selectPatterns: selectPatternsFn,
      },
    };
  });
});

jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: () => <span>Skeleton Mock</span>,
  };
});

describe.skip("SoftwarePage", () => {
  it("displays a progress when the backend in busy", async () => {
    getStatusFn.mockResolvedValue(BUSY);
    await act(async () => installerRender(<SoftwarePage />));
    screen.getAllByText("Skeleton Mock");
  });

  it("clicking in a pattern's checkbox selects the pattern", async () => {
    getStatusFn.mockResolvedValue(IDLE);

    const { user } = installerRender(<SoftwarePage />);
    const button = await screen.findByRole("button", { name: "Change selection" });
    await user.click(button);

    const basePatterns = await screen.findByRole("region", {
      name: "Base Technologies",
    });
    const row = await within(basePatterns).findByRole("row", { name: /YaST Base/ });
    const checkbox = await within(row).findByRole("checkbox");

    expect(checkbox).toBeChecked();
  });
});
