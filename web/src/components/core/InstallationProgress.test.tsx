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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { InstallationPhase } from "~/types/status";
import InstallationProgress from "./InstallationProgress";
import { ROOT } from "~/routes/paths";

let isBusy = false;
let phase = InstallationPhase.Install;
const mockInstallerStatusChanges = jest.fn();

jest.mock("~/components/core/ProgressReport", () => () => <div>ProgressReport Mock</div>);

jest.mock("~/queries/status", () => ({
  ...jest.requireActual("~/queries/status"),
  useInstallerStatus: () => ({ isBusy, phase }),
  useInstallerStatusChanges: () => mockInstallerStatusChanges(),
}));

describe("InstallationProgress", () => {
  it("subscribes to installer status", () => {
    installerRender(<InstallationProgress />);
    expect(mockInstallerStatusChanges).toHaveBeenCalled();
  });

  describe("when not in an installation phase", () => {
    beforeEach(() => {
      phase = InstallationPhase.Config;
    });

    it("redirects to the root path", async () => {
      installerRender(<InstallationProgress />);
      await screen.findByText(`Navigating to ${ROOT.root}`);
    });
  });

  describe("when installer in the installation phase and busy", () => {
    beforeEach(() => {
      phase = InstallationPhase.Install;
      isBusy = true;
    });

    it("renders progress report", () => {
      installerRender(<InstallationProgress />);
      screen.getByText("ProgressReport Mock");
    });
  });

  describe("when installer in the installation phase but not busy", () => {
    beforeEach(() => {
      phase = InstallationPhase.Install;
      isBusy = false;
    });

    it("redirect to installation finished path", async () => {
      installerRender(<InstallationProgress />);
      await screen.findByText(`Navigating to ${ROOT.installationFinished}`);
    });
  });
});
