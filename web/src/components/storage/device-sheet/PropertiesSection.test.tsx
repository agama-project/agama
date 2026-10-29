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
import { installerRender, mockNavigateFn } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import PropertiesSection from "~/components/storage/device-sheet/PropertiesSection";

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => ({
    drives: [{ name: "/dev/vda" }, { name: "/dev/vdb" }],
    volumeGroups: [{ vgName: "other" }, { vgName: "system" }],
  }),
}));

const entry = (group: ConfigModel.VolumeGroup): Entry => ({
  config: group,
  device: null,
  name: group.vgName,
  isVolumeGroup: true,
});

const subject = { collection: "volumeGroups" as const, index: 1 };

describe("PropertiesSection", () => {
  it("says in one sentence where the physical volumes come from, each disk a way to its panel", () => {
    installerRender(
      <PropertiesSection
        entry={entry({ vgName: "system", targetDevices: ["/dev/vda", "/dev/vdb"] })}
        subject={subject}
      />,
    );

    expect(screen.getByRole("paragraph")).toHaveTextContent("Physical volumes on vda and vdb.");
    screen.getByRole("link", { name: "vda" });
    screen.getByRole("link", { name: "vdb" });
  });

  it("says when no disk is chosen yet", () => {
    installerRender(<PropertiesSection entry={entry({ vgName: "system" })} subject={subject} />);

    screen.getByText("No device chosen yet for its physical volumes.");
  });

  it("says only what its form can change, nothing about its name or how much it takes", () => {
    installerRender(
      <PropertiesSection
        entry={entry({
          vgName: "system",
          targetDevicesPolicy: "useNeeded",
          extentSize: 4 * 1024 ** 2,
        })}
        subject={subject}
      />,
    );

    expect(screen.queryByRole("term")).toBeNull();
    expect(screen.queryByText("system")).toBeNull();
    expect(screen.queryByText(/MiB/)).toBeNull();
  });

  it("links to the form of this very group", async () => {
    const { user } = installerRender(
      <PropertiesSection entry={entry({ vgName: "system" })} subject={subject} />,
    );
    await user.click(screen.getByRole("link", { name: "Edit the volume group" }));

    expect(mockNavigateFn).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/storage/volume-groups/1/edit" }),
      expect.anything(),
    );
  });
});
