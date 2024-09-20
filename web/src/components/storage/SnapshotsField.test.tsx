/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import SnapshotsField, { SnapshotsFieldProps } from "~/components/storage/SnapshotsField";
import { Volume, VolumeTarget } from "~/types/storage";

const rootVolume: Volume = {
  mountPath: "/",
  target: VolumeTarget.DEFAULT,
  fsType: "Btrfs",
  minSize: 1024,
  autoSize: true,
  snapshots: true,
  transactional: false,
  outline: {
    required: true,
    fsTypes: ["ext4", "btrfs"],
    supportAutoSize: true,
    snapshotsConfigurable: false,
    snapshotsAffectSizes: true,
    adjustByRam: false,
    sizeRelevantVolumes: ["/home"],
    productDefined: true,
  },
};

const onChangeFn = jest.fn();

let props: SnapshotsFieldProps;

describe("SnapshotsField", () => {
  it("reflects snapshots status", () => {
    props = { rootVolume: { ...rootVolume, snapshots: true }, onChange: onChangeFn };
    plainRender(<SnapshotsField {...props} />);
    const checkbox: HTMLInputElement = screen.getByRole("checkbox");
    expect(checkbox.value).toEqual("on");
  });

  it("allows toggling snapshots status", async () => {
    props = { rootVolume: { ...rootVolume, snapshots: true }, onChange: onChangeFn };
    const { user } = plainRender(<SnapshotsField {...props} />);
    const checkbox: HTMLInputElement = screen.getByRole("checkbox");
    await user.click(checkbox);
    expect(onChangeFn).toHaveBeenCalledWith({ active: false });
  });
});
