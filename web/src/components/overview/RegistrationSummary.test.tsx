/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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
import { installerRender, mockProduct } from "~/test-utils";
import { useIssues } from "~/hooks/model/issue";
import { useSystem } from "~/hooks/model/system/software";
import RegistrationSummary from "./RegistrationSummary";

const mockUseSystem = jest.fn();
const mockUseIssuesFn: jest.Mock<ReturnType<typeof useIssues>> = jest.fn();

jest.mock("~/hooks/model/system/software", () => ({
  ...jest.requireActual("~/hooks/model/system/software"),
  useSystem: (): jest.Mock<ReturnType<typeof useSystem>> => mockUseSystem(),
}));

jest.mock("~/hooks/model/issue", () => ({
  ...jest.requireActual("~/hooks/model/issue"),
  useIssues: () => mockUseIssuesFn(),
}));

describe("RegistrationSummary", () => {
  beforeEach(() => {
    mockUseIssuesFn.mockReturnValue([]);
  });
  describe("when selected product is not registrable", () => {
    beforeEach(() => {
      mockProduct({
        id: "Tumbleweed",
        name: "openSUSE Tumbleweed",
        icon: "tumbleweed.svg",
        description: "Tumbleweed description...",
        registration: false,
      });
    });

    it("renders nothing", () => {
      const { container } = installerRender(<RegistrationSummary />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when selected product is registrable", () => {
    beforeEach(() => {
      mockProduct({
        id: "Tumbleweed",
        name: "openSUSE Tumbleweed",
        icon: "tumbleweed.svg",
        description: "Tumbleweed description...",
        registration: true,
      });
    });

    describe("and it is already registered", () => {
      beforeEach(() => {
        mockUseSystem.mockReturnValue({
          addons: [],
          patterns: [],
          repositories: [],
          registration: { code: "123456789", addons: [] },
        });
      });

      it("renders the registration summary with no issues and registered state", () => {
        installerRender(<RegistrationSummary />);
        // Check if the registration summary is displayed with the correct text
        screen.getByText(/Registration/);
        screen.getByText(/Registered/);
        screen.getByText(/Using code ending in/);
        screen.getByText("6789");
      });
    });

    describe("and it is already registered without a code", () => {
      beforeEach(() => {
        mockUseSystem.mockReturnValue({
          addons: [],
          patterns: [],
          repositories: [],
          registration: { addons: [] },
        });
      });

      it("renders the registration summary with no issues and registered state without code", () => {
        installerRender(<RegistrationSummary />);
        // Check if the registration summary is displayed with the correct text
        screen.getByText(/Registration/);
        screen.getByText(/Registered without a code/);
      });
    });

    describe("but it is not registered yet", () => {
      beforeEach(() => {
        mockUseSystem.mockReturnValue({
          addons: [],
          patterns: [],
          repositories: [],
        });
      });

      it("renders the registration summary with no issues and registered state", () => {
        installerRender(<RegistrationSummary />);
        // Check if the registration summary is displayed with the correct text
        screen.getByText(/Registration/);
        screen.getByText(/Not registered yet/);
      });
    });
  });
});
