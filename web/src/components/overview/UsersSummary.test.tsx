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
import { installerRender, mockProgresses } from "~/test-utils";
import { useConfig } from "~/hooks/model/config";
import { useIssues } from "~/hooks/model/issue";
import { USER } from "~/routes/paths";
import UsersSummary from "./UsersSummary";

const mockUseConfigFn: jest.Mock<ReturnType<typeof useConfig>> = jest.fn();
const mockUseIssuesFn: jest.Mock<ReturnType<typeof useIssues>> = jest.fn();

jest.mock("~/hooks/model/config", () => ({
  useConfig: () => mockUseConfigFn(),
}));

jest.mock("~/hooks/model/issue", () => ({
  ...jest.requireActual("~/hooks/model/issue"),
  useIssues: () => mockUseIssuesFn(),
}));

describe("UsersSummary", () => {
  beforeEach(() => {
    mockProgresses([]);
    mockUseIssuesFn.mockReturnValue([]);
    mockUseConfigFn.mockReturnValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the clickable 'Authentication' header", () => {
    installerRender(<UsersSummary />);
    const heading = screen.getByRole("heading");
    const link = within(heading).getByRole("link", { name: "Authentication" });
    expect(link).toHaveAttribute("href", expect.stringContaining(USER.root));
  });

  describe("when users data is still loading", () => {
    beforeEach(() => {
      mockProgresses([
        {
          scope: "users",
          size: 1,
          steps: ["Loading users configuration"],
          step: "Loading users configuration",
          index: 1,
        },
      ]);
    });

    it("renders skeleton instead of content", () => {
      installerRender(<UsersSummary />);
      screen.getByLabelText("Waiting for proposal");
    });
  });

  describe("when users data is loaded", () => {
    describe("when nothing is configured", () => {
      beforeEach(() => {
        mockUseConfigFn.mockReturnValue({});
      });

      it("displays 'Not configured yet'", () => {
        installerRender(<UsersSummary />);
        screen.getByText("Not configured yet");
      });

      it("does not display any description", () => {
        installerRender(<UsersSummary />);
        expect(screen.queryByText(/Password/)).not.toBeInTheDocument();
        expect(screen.queryByText(/SSH/)).not.toBeInTheDocument();
      });
    });

    describe("when only root is configured", () => {
      describe("with password only", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            root: { password: "secret123" },
          });
        });

        it("displays 'Using root account'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Using root account");
        });

        it("displays 'Password only'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Password only");
        });
      });

      describe("with SSH key only (old sshPublicKey field)", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            root: { sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EA... root@host" },
          });
        });

        it("displays 'Using root account'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Using root account");
        });

        it("displays 'Allowing SSH access via public key'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Allowing SSH access via public key");
        });
      });

      describe("with SSH key only (new sshPublicKeys field as string)", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            root: { sshPublicKeys: "ssh-rsa AAAAB3NzaC1yc2EA... root@host" },
          });
        });

        it("displays 'Using root account'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Using root account");
        });

        it("displays 'Allowing SSH access via public key'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Allowing SSH access via public key");
        });
      });

      describe("with SSH key only (new sshPublicKeys field as array)", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            root: {
              sshPublicKeys: [
                "ssh-rsa AAAAB3NzaC1yc2EA... root@host1",
                "ssh-rsa AAAAB3NzaC1yc2EA... root@host2",
              ],
            },
          });
        });

        it("displays 'Using root account'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Using root account");
        });

        it("displays 'Allowing SSH access via public key'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Allowing SSH access via public key");
        });
      });

      describe("with password and SSH key (old field)", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            root: {
              password: "secret123",
              sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EA... root@host",
            },
          });
        });

        it("displays 'Using root account'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Using root account");
        });

        it("displays 'Password and allowing SSH access'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Password and allowing SSH access");
        });
      });

      describe("with password and SSH key (new field)", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            root: {
              password: "secret123",
              sshPublicKeys: ["ssh-rsa AAAAB3NzaC1yc2EA... root@host"],
            },
          });
        });

        it("displays 'Using root account'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Using root account");
        });

        it("displays 'Password and allowing SSH access'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Password and allowing SSH access");
        });
      });
    });

    describe("when only user is configured", () => {
      describe("with password only", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            user: {
              userName: "jdoe",
              fullName: "John Doe",
              password: "secret456",
            },
          });
        });

        it("displays 'Using {username} account'", () => {
          installerRender(<UsersSummary />);
          screen.getByText(/Using/);
          screen.getByText("jdoe");
          screen.getByText(/account/);
        });

        it("displays 'Password only'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Password only");
        });
      });

      describe("with password and SSH key", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            user: {
              userName: "jdoe",
              fullName: "John Doe",
              password: "secret456",
              sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EA... jdoe@host",
            },
          });
        });

        it("displays 'Using {username} account'", () => {
          installerRender(<UsersSummary />);
          screen.getByText(/Using/);
          screen.getByText("jdoe");
          screen.getByText(/account/);
        });

        it("displays 'Allowing SSH access via public key'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Allowing SSH access via public key");
        });
      });
    });

    describe("when both root and user are configured", () => {
      describe("root with password, user without SSH", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            root: { password: "secret123" },
            user: {
              userName: "jdoe",
              fullName: "John Doe",
              password: "secret456",
            },
          });
        });

        it("displays 'Using {username} and root account'", () => {
          installerRender(<UsersSummary />);
          screen.getByText(/Using/);
          screen.getByText("jdoe");
          screen.getByText(/and root account/);
        });

        it("displays 'Root with password only'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Root with password only");
        });
      });

      describe("root with password, user with SSH", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            root: { password: "secret123" },
            user: {
              userName: "jdoe",
              fullName: "John Doe",
              password: "secret456",
              sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EA... jdoe@host",
            },
          });
        });

        it("displays 'Root with password only, user allowing SSH access'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Root with password only, user allowing SSH access");
        });
      });

      describe("root with SSH only, user without SSH", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            root: { sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EA... root@host" },
            user: {
              userName: "jdoe",
              fullName: "John Doe",
              password: "secret456",
            },
          });
        });

        it("displays 'Root allowing SSH access via public key'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Root allowing SSH access via public key");
        });
      });

      describe("root with SSH only, user with SSH", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            root: { sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EA... root@host" },
            user: {
              userName: "jdoe",
              fullName: "John Doe",
              password: "secret456",
              sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EA... jdoe@host",
            },
          });
        });

        it("displays 'Both allowing SSH access via public key'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Both allowing SSH access via public key");
        });
      });

      describe("root with password and SSH, user without SSH", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            root: {
              password: "secret123",
              sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EA... root@host",
            },
            user: {
              userName: "jdoe",
              fullName: "John Doe",
              password: "secret456",
            },
          });
        });

        it("displays 'Root with password and allowing SSH access'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Root with password and allowing SSH access");
        });
      });

      describe("root with password and SSH, user with SSH", () => {
        beforeEach(() => {
          mockUseConfigFn.mockReturnValue({
            root: {
              password: "secret123",
              sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EA... root@host",
            },
            user: {
              userName: "jdoe",
              fullName: "John Doe",
              password: "secret456",
              sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EA... jdoe@host",
            },
          });
        });

        it("displays 'Both with password and allowing SSH access'", () => {
          installerRender(<UsersSummary />);
          screen.getByText("Both with password and allowing SSH access");
        });
      });
    });

    describe("when there are issues", () => {
      beforeEach(() => {
        mockUseConfigFn.mockReturnValue({
          root: { password: "secret123" },
        });
        mockUseIssuesFn.mockReturnValue([
          {
            description: "Root password is too weak",
            class: "warning",
            scope: "users",
          },
        ]);
      });

      it("displays warning icon for issues", () => {
        const { container } = installerRender(<UsersSummary />);
        const warningIcon = container.querySelector("svg.pf-v6-u-text-color-status-warning");
        expect(warningIcon).toBeInTheDocument();
      });
    });
  });
});
