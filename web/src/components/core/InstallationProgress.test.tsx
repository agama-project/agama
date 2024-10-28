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

jest.mock("~/components/core/ProgressReport", () => () => <div>ProgressReport Mock</div>);

jest.mock("~/queries/status", () => ({
  ...jest.requireActual("~/queries/status"),
  useInstallerStatus: () => ({ isBusy: true, phase: InstallationPhase.Install }),
}));

describe("InstallationProgress", () => {
  it("renders progress report", () => {
    installerRender(<InstallationProgress />);
    screen.getByText("ProgressReport Mock");
  });

  it.todo("redirects to root path when not in an installation phase");
  it.todo("redirects to installatino finished path if in an installation phase but not busy");
});
