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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useProposal } from "~/hooks/model/proposal/hostname";
import { useConfig } from "~/hooks/model/config";
import { SYSTEM } from "~/routes/paths";
import SystemSummary from "./SystemSummary";

const mockUseProposalFn: jest.Mock<ReturnType<typeof useProposal>> = jest.fn();
const mockUseConfigFn: jest.Mock<ReturnType<typeof useConfig>> = jest.fn();

jest.mock("~/hooks/model/proposal/hostname", () => ({
  useProposal: () => mockUseProposalFn(),
}));

jest.mock("~/hooks/model/config", () => ({
  useConfig: () => mockUseConfigFn(),
}));

describe("SystemSummary", () => {
  describe("with static hostname and no custom NTP servers", () => {
    beforeEach(() => {
      mockUseProposalFn.mockReturnValue({
        hostname: "",
        static: "my-custom-hostname",
      });
      mockUseConfigFn.mockReturnValue({
        ntp: { sources: [] },
      });
    });

    it("renders the clickable 'System' header", () => {
      installerRender(<SystemSummary />);
      const heading = screen.getByRole("heading");
      const link = within(heading).getByRole("link", { name: "System" });
      expect(link).toHaveAttribute("href", expect.stringContaining(SYSTEM.root));
    });

    it("renders the static hostname in the value", () => {
      installerRender(<SystemSummary />);
      screen.getByText("my-custom-hostname");
    });

    it("renders default NTP indication in description", () => {
      installerRender(<SystemSummary />);
      screen.getByText(/Default NTP/);
    });

    it("does not render transient explanation for static hostname", () => {
      installerRender(<SystemSummary />);
      expect(
        screen.queryByText(
          "Using transient name, which may change after reboot or network changes",
        ),
      ).not.toBeInTheDocument();
    });
  });

  describe("with static hostname and one custom NTP server", () => {
    beforeEach(() => {
      mockUseProposalFn.mockReturnValue({
        hostname: "",
        static: "my-custom-hostname",
      });
      mockUseConfigFn.mockReturnValue({
        ntp: {
          sources: [{ type: "pool", address: "pool.ntp.org", iburst: true, offline: false }],
        },
      });
    });

    it("renders the static hostname in the value", () => {
      installerRender(<SystemSummary />);
      screen.getByText("my-custom-hostname");
    });

    it("renders singular NTP server info in description", () => {
      installerRender(<SystemSummary />);
      screen.getByText(/Using/);
      screen.getByText("pool.ntp.org");
      screen.getByText(/as NTP server/);
      expect(screen.queryByText(/servers/)).not.toBeInTheDocument();
    });

    it("does not render transient explanation", () => {
      installerRender(<SystemSummary />);
      expect(
        screen.queryByText(
          "Using transient name, which may change after reboot or network changes",
        ),
      ).not.toBeInTheDocument();
    });
  });

  describe("with static hostname and multiple custom NTP servers", () => {
    beforeEach(() => {
      mockUseProposalFn.mockReturnValue({
        hostname: "",
        static: "my-custom-hostname",
      });
      mockUseConfigFn.mockReturnValue({
        ntp: {
          sources: [
            { type: "pool", address: "pool.ntp.org", iburst: true, offline: false },
            { type: "server", address: "time.example.com", iburst: true, offline: false },
          ],
        },
      });
    });

    it("renders the static hostname in the value", () => {
      installerRender(<SystemSummary />);
      screen.getByText("my-custom-hostname");
    });

    it("renders NTP server info in description with first server", () => {
      installerRender(<SystemSummary />);
      screen.getByText(/Using 2 NTP servers, including/);
      screen.getByText("pool.ntp.org");
    });

    it("does not render transient explanation", () => {
      installerRender(<SystemSummary />);
      expect(
        screen.queryByText(
          "Using transient name, which may change after reboot or network changes",
        ),
      ).not.toBeInTheDocument();
    });
  });

  describe("with transient hostname only", () => {
    beforeEach(() => {
      mockUseProposalFn.mockReturnValue({
        hostname: "linux-abcd",
        static: "",
      });
      mockUseConfigFn.mockReturnValue({
        ntp: { sources: [] },
      });
    });

    it("renders the clickable 'System' header", () => {
      installerRender(<SystemSummary />);
      const heading = screen.getByRole("heading");
      const link = within(heading).getByRole("link", { name: "System" });
      expect(link).toHaveAttribute("href", expect.stringContaining(SYSTEM.root));
    });

    it("renders the transient hostname in the value", () => {
      installerRender(<SystemSummary />);
      screen.getByText("linux-abcd");
    });

    it("renders default NTP inline in the value", () => {
      installerRender(<SystemSummary />);
      screen.getByText(/Default NTP/);
    });

    it("renders the transient hostname explanation in description", () => {
      installerRender(<SystemSummary />);
      screen.getByText("Using transient name, which may change after reboot or network changes");
    });
  });

  describe("with transient hostname and one custom NTP server", () => {
    beforeEach(() => {
      mockUseProposalFn.mockReturnValue({
        hostname: "linux-abcd",
        static: "",
      });
      mockUseConfigFn.mockReturnValue({
        ntp: {
          sources: [{ type: "pool", address: "pool.ntp.org", iburst: true, offline: false }],
        },
      });
    });

    it("renders hostname in the value", () => {
      installerRender(<SystemSummary />);
      screen.getByText("linux-abcd");
    });

    it("renders singular NTP server count inline in the value", () => {
      installerRender(<SystemSummary />);
      screen.getByText(/1 NTP server/);
      expect(screen.queryByText(/servers/)).not.toBeInTheDocument();
    });

    it("renders the transient hostname explanation in description", () => {
      installerRender(<SystemSummary />);
      screen.getByText("Using transient name, which may change after reboot or network changes");
    });
  });

  describe("with both hostnames set", () => {
    beforeEach(() => {
      mockUseProposalFn.mockReturnValue({
        hostname: "temporary-name",
        static: "permanent-hostname",
      });
      mockUseConfigFn.mockReturnValue({
        ntp: { sources: [] },
      });
    });

    it("renders static hostname", () => {
      installerRender(<SystemSummary />);
      screen.getByText(/permanent-hostname/);
      expect(screen.queryByText(/temporary-name/)).not.toBeInTheDocument();
    });

    it("does not render the transient hostname explanation", () => {
      installerRender(<SystemSummary />);
      expect(
        screen.queryByText(
          "Using transient name, which may change after reboot or network changes",
        ),
      ).not.toBeInTheDocument();
    });
  });

  describe("when there is no hostname at all", () => {
    beforeEach(() => {
      mockUseProposalFn.mockReturnValue({
        hostname: "",
        static: "",
      });
      mockUseConfigFn.mockReturnValue({
        ntp: { sources: [] },
      });
    });

    it("renders the transient hostname explanation", () => {
      installerRender(<SystemSummary />);
      screen.getByText("Using transient name, which may change after reboot or network changes");
    });
  });

  describe("when config has no NTP data", () => {
    beforeEach(() => {
      mockUseProposalFn.mockReturnValue({
        hostname: "test-host",
        static: "",
      });
      mockUseConfigFn.mockReturnValue(null);
    });

    it("renders with default NTP indication", () => {
      installerRender(<SystemSummary />);
      screen.getByText(/test-host/);
      screen.getByText(/Default NTP/);
    });

    it("renders transient hostname explanation", () => {
      installerRender(<SystemSummary />);
      screen.getByText("Using transient name, which may change after reboot or network changes");
    });
  });
});
