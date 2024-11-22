/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { screen, waitFor, within } from "@testing-library/react";
import { installerRender, mockRoutes } from "~/test-utils";
import { InstallButton } from "~/components/core";
import { IssuesList } from "~/types/issues";
import { PRODUCT, ROOT } from "~/routes/paths";

const mockStartInstallationFn = jest.fn();
let mockIssuesList: IssuesList;

jest.mock("~/api/manager", () => ({
  ...jest.requireActual("~/api/manager"),
  startInstallation: () => mockStartInstallationFn(),
}));

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useAllIssues: () => mockIssuesList,
}));

const clickInstallButton = async () => {
  const { user } = installerRender(<InstallButton />);
  const button = await screen.findByRole("button", { name: "Install" });
  await user.click(button);

  const dialog = screen.getByRole("dialog", { name: "Confirm Installation" });
  return { user, dialog };
};

describe("InstallButton", () => {
  describe("when there are installation issues", () => {
    beforeEach(() => {
      mockIssuesList = new IssuesList(
        [
          {
            description: "Fake Issue",
            source: 0,
            severity: 0,
            details: "Fake Issue details",
          },
        ],
        [],
        [],
        [],
      );
    });

    it("renders additional information to warn users about found problems", () => {
      const { container } = installerRender(<InstallButton />);
      const button = screen.getByRole("button", { name: /Install/ });
      // An exlamation icon as visual mark
      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("data-icon-name", "exclamation");
      // An aria-label for users using an screen reader
      within(button).getByLabelText(/Not possible with current setup/);
    });

    it("triggers the onClickWithIssues callback without rendering the confirmation dialog", async () => {
      const onClickWithIssuesFn = jest.fn();
      const { user } = installerRender(<InstallButton onClickWithIssues={onClickWithIssuesFn} />);
      const button = screen.getByRole("button", { name: /Install/ });
      await user.click(button);
      expect(onClickWithIssuesFn).toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
  });

  describe("when there are not installation issues", () => {
    beforeEach(() => {
      mockIssuesList = new IssuesList([], [], [], []);
    });

    it("renders the button without any additional information", () => {
      const { container } = installerRender(<InstallButton />);
      const button = screen.getByRole("button", { name: "Install" });
      // Renders nothing else
      const icon = container.querySelector("svg");
      expect(icon).toBeNull();
      expect(within(button).queryByLabelText(/Not possible with current setup/)).toBeNull();
    });

    it("renders a confirmation dialog when clicked without triggering the onClickWithIssues callback", async () => {
      const onClickWithIssuesFn = jest.fn();
      const { user } = installerRender(<InstallButton onClickWithIssues={onClickWithIssuesFn} />);
      const button = await screen.findByRole("button", { name: "Install" });
      await user.click(button);
      expect(onClickWithIssuesFn).not.toHaveBeenCalled();
      screen.getByRole("dialog", { name: "Confirm Installation" });
    });

    describe.each([
      ["login", ROOT.login],
      ["product selection", PRODUCT.changeProduct],
      ["product selection progress", PRODUCT.progress],
      ["installation progress", ROOT.installationProgress],
      ["installation finished", ROOT.installationFinished],
    ])(`but the installer is rendering the %s screen`, (_, path) => {
      beforeEach(() => {
        mockRoutes(path);
      });

      it("renders nothing", () => {
        const { container } = installerRender(<InstallButton />);
        expect(container).toBeEmptyDOMElement();
      });
    });
  });
});

describe("InstallConfirmationPopup", () => {
  it("closes the dialog without triggering installation if user press {enter} before 'Continue' gets the focus", async () => {
    const { user, dialog } = await clickInstallButton();
    const continueButton = within(dialog).getByRole("button", { name: "Continue" });
    expect(continueButton).not.toHaveFocus();
    await user.keyboard("{enter}");
    expect(mockStartInstallationFn).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });
  });

  it("closes the dialog and triggers installation if user {enter} when 'Continue' has the focus", async () => {
    const { user, dialog } = await clickInstallButton();
    const continueButton = within(dialog).getByRole("button", { name: "Continue" });
    expect(continueButton).not.toHaveFocus();
    await user.keyboard("{tab}");
    expect(continueButton).toHaveFocus();
    await user.keyboard("{enter}");
    expect(mockStartInstallationFn).toHaveBeenCalled();
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });
  });

  it("closes the dialog and triggers installation if user clicks on 'Continue'", async () => {
    const { user, dialog } = await clickInstallButton();
    const continueButton = within(dialog).getByRole("button", { name: "Continue" });
    await user.click(continueButton);
    expect(mockStartInstallationFn).toHaveBeenCalled();
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });
  });

  it("closes the dialog without triggering installation if the user clicks on 'Cancel'", async () => {
    const { user, dialog } = await clickInstallButton();
    const cancelButton = within(dialog).getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);
    expect(mockStartInstallationFn).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });
  });
});
