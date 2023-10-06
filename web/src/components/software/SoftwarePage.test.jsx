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
import { act, screen } from "@testing-library/react";
import { installerRender, mockComponent } from "~/test-utils";
import { BUSY, IDLE } from "~/client/status";

import { createClient } from "~/client";

import SoftwarePage from "./SoftwarePage";

const PatternSelectorMock = "<PatternSelector/> Mock";
jest.mock("~/components/software/PatternSelector", () => mockComponent(PatternSelectorMock));
jest.mock("~/client");
const getStatusFn = jest.fn();
const onStatusChangeFn = jest.fn();
beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      software: {
        getStatus: getStatusFn,
        onStatusChange: onStatusChangeFn
      },
    };
  });
});

const SkeletonMock = "<Skeleton/> mock";
jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: mockComponent(SkeletonMock)
  };
});

describe("SoftwarePage", () => {
  it("displays a progress when the backend in busy", async () => {
    getStatusFn.mockResolvedValue(BUSY);
    await act(async () => installerRender(<SoftwarePage />));
    screen.getAllByText(SkeletonMock);
  });

  it("displays the PatternSelector when the backend in ready", async () => {
    getStatusFn.mockResolvedValue(IDLE);
    await act(async () => installerRender(<SoftwarePage />));
    screen.getByText(PatternSelectorMock);
  });
});
