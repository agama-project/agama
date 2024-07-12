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
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { SIZE_METHODS } from "~/components/storage/utils";
import { FsField, MountPathField, SizeOptionsField } from "~/components/storage/VolumeFields";

/**
 * @typedef {import ("~/client/storage").Volume} Volume
 */

/** @type {Volume} */
const volume = {
  mountPath: "/home",
  target: "DEFAULT",
  fsType: "XFS",
  minSize: 1024,
  maxSize: 4096,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: false,
    fsTypes: ["Ext4", "XFS"],
    supportAutoSize: false,
    snapshotsConfigurable: false,
    snapshotsAffectSizes: false,
    adjustByRam: false,
    sizeRelevantVolumes: [],
    productDefined: true,
  },
};

const callbackFn = jest.fn();

describe("MountPathField", () => {
  it("renders a text input with given value", () => {
    const { rerender } = plainRender(<MountPathField value="/home" onChange={callbackFn} />);
    const input = screen.getByRole("textbox", { name: "Mount point" });
    expect(input).toHaveValue("/home");
    rerender(<MountPathField value="/var" onChange={callbackFn} />);
    expect(input).toHaveValue("/var");
  });

  it("renders given error", () => {
    plainRender(
      <MountPathField value="/home" onChange={callbackFn} error="Something went wrong" />,
    );
    screen.getByText("Something went wrong");
  });

  it("calls given callback when user changes its content", async () => {
    const { user } = plainRender(<MountPathField value="" onChange={callbackFn} />);
    const input = screen.getByRole("textbox", { name: "Mount point" });
    // NOTE: MountPathField is a controlled component. That makes a bit more
    // difficult to write more sensible test here by typing "/var" and expecting that
    // callback is called multiple times with "/", "/v", "/va", and "/var". It
    // will not work because it's actually triggering the onChange with "/",
    // "v", "a", and "r", but having a different "value" each time it's
    // re-rendered. Anyway, checking that callback is called is enough.
    await user.type(input, "/");
    expect(callbackFn).toHaveBeenCalledWith("/");
  });

  it("renders only the value if mount as read-only (no input)", () => {
    plainRender(<MountPathField value="/home" onChange={callbackFn} isReadOnly />);
    expect(screen.queryByRole("textbox", { name: "Mount point" })).toBeNull();
    screen.getByText("/home");
  });
});

describe("SizeOptionsField", () => {
  it("renders radio group with sizing options", () => {
    plainRender(
      <SizeOptionsField formData={{ sizeMethod: "fixed" }} volume={volume} onChange={callbackFn} />,
    );
    screen.getByRole("radiogroup", { name: "Size" });
  });

  it("renders 'Fixed' and 'Range' options always but 'Auto' only if volume accepts auto size", () => {
    const { rerender } = plainRender(
      <SizeOptionsField formData={{ sizeMethod: "fixed" }} volume={volume} onChange={callbackFn} />,
    );
    const group = screen.getByRole("radiogroup", { name: "Size" });
    within(group).getByRole("radio", { name: "Fixed" });
    within(group).getByRole("radio", { name: "Range" });
    expect(within(group).queryByRole("radio", { name: "Auto" })).toBeNull();

    rerender(
      <SizeOptionsField
        formData={{ sizeMethod: "fixed" }}
        volume={{ ...volume, outline: { ...volume.outline, supportAutoSize: true } }}
        onChange={callbackFn}
      />,
    );
    within(group).getByRole("radio", { name: "Auto" });
    within(group).getByRole("radio", { name: "Fixed" });
    within(group).getByRole("radio", { name: "Range" });
  });

  it("renders options as disabled when isDisabled props is given", () => {
    plainRender(
      <SizeOptionsField
        formData={{ sizeMethod: "fixed" }}
        volume={{ ...volume, outline: { ...volume.outline, supportAutoSize: true } }}
        onChange={callbackFn}
        isDisabled
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Size" });
    within(group)
      .getAllByRole("radio")
      .forEach((option) => expect(option).toBeDisabled());
  });

  it("calls given callback when user changes selected option", async () => {
    const { user } = plainRender(
      <SizeOptionsField formData={{ sizeMethod: "fixed" }} volume={volume} onChange={callbackFn} />,
    );
    const group = screen.getByRole("radiogroup", { name: "Size" });
    const rangeOption = within(group).getByRole("radio", { name: "Range" });
    await user.click(rangeOption);
    expect(callbackFn).toHaveBeenCalledWith({ sizeMethod: SIZE_METHODS.RANGE });
  });

  it.todo("test SizeAuto internal component");
  it.todo("test SizeManual internal component");
  it.todo("test SizeRange internal component");
});

describe("FsField", () => {
  it("renders control for selecting a file system, with the given value as initial selection", async () => {
    const { user, rerender } = plainRender(
      <FsField value="XFS" volume={volume} onChange={callbackFn} />,
    );
    let button = screen.getByRole("button", { name: "File system type" });
    await user.click(button);
    const xfsOption = screen.getByRole("option", { name: "XFS" });
    let ext4Option = screen.getByRole("option", { name: "Ext4" });
    expect(xfsOption).toHaveAttribute("aria-selected", "true");
    expect(ext4Option).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByRole("option", { name: "Btrfs" })).toBeNull();

    rerender(
      <FsField
        value="Ext4"
        volume={{ ...volume, outline: { ...volume.outline, fsTypes: ["Btrfs", "Ext4"] } }}
        onChange={callbackFn}
      />,
    );
    button = screen.getByRole("button", { name: "File system type" });
    await user.click(button);
    ext4Option = screen.getByRole("option", { name: "Ext4" });
    const btrfsOption = screen.getByRole("option", { name: "Btrfs" });
    expect(ext4Option).toHaveAttribute("aria-selected", "true");
    expect(btrfsOption).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByRole("option", { name: "XFS" })).toBeNull();
  });

  it("renders control as disabled when isDisabled is given", () => {
    plainRender(<FsField value="XFS" volume={volume} onChange={callbackFn} isDisabled />);
    const button = screen.getByRole("button", { name: "File system type" });
    expect(button).toBeDisabled();
  });

  it("calls given callback when user clicks on an option", async () => {
    const { user } = plainRender(<FsField value="XFS" volume={volume} onChange={callbackFn} />);
    const button = screen.getByRole("button", { name: "File system type" });
    await user.click(button);
    const ext4Option = screen.getByRole("option", { name: "Ext4" });
    await user.click(ext4Option);
    expect(callbackFn).toHaveBeenCalledWith(expect.objectContaining({ fsType: "Ext4" }));
  });
});
