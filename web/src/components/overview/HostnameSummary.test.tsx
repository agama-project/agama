import React from "react";
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useProposal } from "~/hooks/model/proposal/hostname";
import HostnameSummary from "./HostnameSummary";
import { HOSTNAME } from "~/routes/paths";

const mockUseProposalFn: jest.Mock<ReturnType<typeof useProposal>> = jest.fn();

jest.mock("~/hooks/model/proposal/hostname", () => ({
  useProposal: () => mockUseProposalFn(),
}));

describe("HostnameSummary", () => {
  describe("with static hostname", () => {
    beforeEach(() => {
      mockUseProposalFn.mockReturnValue({
        hostname: "",
        static: "my-custom-hostname",
      });
    });

    it("renders the clickable 'Hostname' header", () => {
      installerRender(<HostnameSummary />);
      const heading = screen.getByRole("heading");
      const link = within(heading).getByRole("link", { name: "Hostname" });
      expect(link).toHaveAttribute("href", expect.stringContaining(HOSTNAME.root));
    });

    it("renders the static hostname as the value", () => {
      installerRender(<HostnameSummary />);
      screen.getByText("my-custom-hostname");
    });

    it("does not render the transient hostname explanation", () => {
      installerRender(<HostnameSummary />);
      expect(
        screen.queryByText("Temporary name that may change after reboot or network changes"),
      ).not.toBeInTheDocument();
    });
  });

  describe("with transient hostname only", () => {
    beforeEach(() => {
      mockUseProposalFn.mockReturnValue({
        hostname: "linux-abcd",
        static: "",
      });
    });

    it("renders the clickable 'Hostname' header", () => {
      installerRender(<HostnameSummary />);
      const heading = screen.getByRole("heading");
      const link = within(heading).getByRole("link", { name: "Hostname" });
      expect(link).toHaveAttribute("href", expect.stringContaining(HOSTNAME.root));
    });

    it("renders the transient hostname as the value", () => {
      installerRender(<HostnameSummary />);
      screen.getByText("linux-abcd");
    });

    it("renders the transient hostname explanation", () => {
      installerRender(<HostnameSummary />);
      screen.getByText("Temporary name that may change after reboot or network changes");
    });
  });

  describe("with both hostnames set", () => {
    beforeEach(() => {
      mockUseProposalFn.mockReturnValue({
        hostname: "temporary-name",
        static: "permanent-hostname",
      });
    });

    it("renders the clickable 'Hostname' header", () => {
      installerRender(<HostnameSummary />);
      const heading = screen.getByRole("heading");
      const link = within(heading).getByRole("link", { name: "Hostname" });
      expect(link).toHaveAttribute("href", expect.stringContaining(HOSTNAME.root));
    });

    it("renders static hostname", () => {
      installerRender(<HostnameSummary />);
      screen.getByText("permanent-hostname");
      expect(screen.queryByText("temporary-name")).not.toBeInTheDocument();
    });

    it("does not render the transient hostname explanation", () => {
      installerRender(<HostnameSummary />);
      expect(
        screen.queryByText("Temporary name that may change after reboot or network changes"),
      ).not.toBeInTheDocument();
    });
  });

  describe("when there is no hostname at all", () => {
    beforeEach(() => {
      mockUseProposalFn.mockReturnValue({
        hostname: "",
        static: "",
      });
    });
    it("renders only the transient hostname explanation", () => {
      installerRender(<HostnameSummary />);
      screen.getByText("Temporary name that may change after reboot or network changes");
    });
  });
});
