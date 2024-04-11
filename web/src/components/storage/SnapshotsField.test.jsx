/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import SnapshotsField from "~/components/storage/SnapshotsField";

/**
 * @typedef {import ("~/client/storage").Volume} Volume
 * @typedef {import ("~/components/storage/SnapshotsField").SnapshotsFieldProps} SnapshotsFieldProps
 */

/** @type {Volume} */
const rootVolume = {
  mountPath: "/",
  target: "/dev/sda",
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
    sizeRelevantVolumes: ["/home"]
  }
};

const onChangeFn = jest.fn();

/** @type {SnapshotsFieldProps} */
let props;

describe("SnapshotsField", () => {
  it("reflects snapshots status", () => {
    let button;

    props = { rootVolume: { ...rootVolume, snapshots: true }, onChange: onChangeFn };
    const { rerender } = plainRender(<SnapshotsField {...props} />);
    button = screen.getByRole("switch");
    expect(button).toHaveAttribute("aria-checked", "true");

    props = { rootVolume: { ...rootVolume, snapshots: false }, onChange: onChangeFn };
    rerender(<SnapshotsField {...props} />);
    button = screen.getByRole("switch");
    expect(button).toHaveAttribute("aria-checked", "false");
  });

  it("allows toggling snapshots status", async () => {
    let button;

    props = { rootVolume: { ...rootVolume, snapshots: true }, onChange: onChangeFn };
    const { user, rerender } = plainRender(<SnapshotsField {...props} />);
    button = screen.getByRole("switch");
    expect(button).toHaveAttribute("aria-checked", "true");
    await user.click(button);
    expect(onChangeFn).toHaveBeenCalledWith({ active: false });

    props = { rootVolume: { ...rootVolume, snapshots: false }, onChange: onChangeFn };
    rerender(<SnapshotsField {...props} />);
    button = screen.getByRole("switch");
    expect(button).toHaveAttribute("aria-checked", "false");
    await user.click(button);
    expect(onChangeFn).toHaveBeenCalledWith({ active: true });
  });
});
