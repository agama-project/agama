/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { DEFAULT_SIZE_UNIT, parseToBytes } from "~/components/storage/utils";
import { VolumeForm } from "~/components/storage";

const volumes = {
  root: {
    mountPath: "/",
    fsType: "Btrfs",
    minSize: 1024,
    maxSize: 2048,
    autoSize: false,
    snapshots: true,
    outline: {
      required: true,
      fsTypes: ["Btrfs", "Ext4"],
      supportAutoSize: true,
      snapshotsConfigurable: true,
      snapshotsAffectSizes: true,
      sizeRelevantVolumes: []
    }
  },
  swap: {
    mountPath: "swap",
    fsType: "Swap",
    minSize: 1024,
    maxSize: 1024,
    autoSize: false,
    snapshots: false,
    outline: {
      required: false,
      fsTypes: ["Swap"],
      supportAutoSize: false,
      snapshotsConfigurable: false,
      snapshotsAffectSizes: false,
      sizeRelevantVolumes: []
    }
  },
  home: {
    mountPath: "/home",
    fsType: "XFS",
    minSize: 1024,
    autoSize: false,
    snapshots: false,
    outline: {
      required: false,
      fsTypes: ["Ext4", "XFS"],
      supportAutoSize: false,
      snapshotsConfigurable: false,
      snapshotsAffectSizes: false,
      sizeRelevantVolumes: []
    }
  }
};

const onSubmitFn = jest.fn();

// TL;DR, the form does not provide a submit button by itself.
// Refers the VolumeForm documentation.
const VolumeFormWrapper = ({ volume, onSubmit }) => {
  return (
    <>
      <VolumeForm id="volume-form-example" volume={volume} onSubmit={onSubmit} />
      <input type="submit" form="volume-form-example" value="Submit VolumeForm" />
    </>
  );
};

let props;

beforeEach(() => {
  props = { templates: [volumes.root, volumes.home, volumes.swap] };
});

it("renders a control for displaying/selecting the file system type", async () => {
  // use home which is not using snapshots
  const { user } = plainRender(<VolumeForm volume={{ ...volumes.home }} />);

  const fsTypeButton = screen.getByRole("button", { name: "File system type" });
  await user.click(fsTypeButton);
  screen.getByRole("option", { name: "XFS" });
  screen.getByRole("option", { name: "Ext4" });
});

it("does not render the file system control if there is only one option", async () => {
  const { user } = plainRender(<VolumeForm {...props} />);

  const mountPointButton = screen.getByRole("button", { name: "Mount point" });
  await user.click(mountPointButton);
  const swap = screen.getByRole("option", { name: "swap" });
  await user.click(swap);
  await screen.findByText("Swap");
  await waitFor(() => (
    expect(screen.queryByRole("button", { name: "File system type" })).not.toBeInTheDocument())
  );
});

it("renders the file system control for root mount point without snapshots", async () => {
  const { user } = plainRender(<VolumeForm volume={{ ...volumes.root, snapshots: false }} />);

  const fsTypeButton = screen.getByRole("button", { name: "File system type" });
  await user.click(fsTypeButton);
  screen.getByRole("option", { name: "Btrfs" });
  screen.getByRole("option", { name: "Ext4" });
});

it("does not render the file system control for root mount point with btrfs with snapshots", async () => {
  plainRender(<VolumeForm {...props} />);

  await screen.findByText("Btrfs");
  await waitFor(() => (
    expect(screen.queryByRole("button", { name: "File system type" })).not.toBeInTheDocument())
  );
});

it("renders controls for setting the desired size", () => {
  plainRender(<VolumeForm {...props} />);

  screen.getByRole("radio", { name: "Auto" });
  screen.getByRole("radio", { name: "Fixed" });
  screen.getByRole("radio", { name: "Range" });
});

it("uses the default size unit when min size unit is missing", () => {
  plainRender(<VolumeForm volume={{ ...volumes.home, minSize: "" }} />);

  const maxSizeUnitSelector = screen.getByRole("combobox", { name: "Unit for the maximum size" });
  expect(maxSizeUnitSelector).toHaveValue(DEFAULT_SIZE_UNIT);
});

it("uses the min size unit as max size unit when it is missing", () => {
  plainRender(<VolumeForm volume={{ ...volumes.home, minSize: "1 TiB" }} />);

  const maxSizeUnitSelector = screen.getByRole("combobox", { name: "Unit for the maximum size" });
  expect(maxSizeUnitSelector).toHaveValue("TiB");
});

it("renders the 'Auto' size option only when a volume with 'adaptive sizes' is selected", async () => {
  const { user } = plainRender(<VolumeForm {...props} />);

  // We know that first volume (root in this example) is selected. And we know
  // that it's configured for allowing adaptive sizes too.
  screen.getByRole("radio", { name: "Auto" });

  const mountPointButton = screen.getByRole("button", { name: "Mount point" });
  await user.click(mountPointButton);

  // And we know that /home volume is not set to allow adaptive sizes. Thus,
  // let's select it.
  const homeVolumeOption = screen.getByRole("option", { name: "/home" });
  await user.click(homeVolumeOption);

  const autoSizeOption = screen.queryByRole("radio", { name: "Auto" });
  expect(autoSizeOption).toBeNull();
});

it("calls the onSubmit callback with resulting volume when the form is submitted", async () => {
  const { user } = plainRender(<VolumeFormWrapper volume={volumes.root} onSubmit={onSubmitFn} />);
  const submitForm = screen.getByRole("button", { name: "Submit VolumeForm" });
  const rangeSize = screen.getByRole("radio", { name: "Range" });

  await user.click(rangeSize);

  const minSizeInput = screen.getByRole("textbox", { name: "Minimum desired size" });
  const minSizeUnitSelector = screen.getByRole("combobox", { name: "Unit for the minimum size" });
  const minSizeGiBUnit = within(minSizeUnitSelector).getByRole("option", { name: "GiB" });
  const maxSizeInput = screen.getByRole("textbox", { name: "Maximum desired size" });
  const maxSizeUnitSelector = screen.getByRole("combobox", { name: "Unit for the maximum size" });
  const maxSizeGiBUnit = within(maxSizeUnitSelector).getByRole("option", { name: "GiB" });

  await user.clear(minSizeInput);
  await user.type(minSizeInput, "10");
  await user.selectOptions(minSizeUnitSelector, minSizeGiBUnit);
  await user.clear(maxSizeInput);
  await user.type(maxSizeInput, "25");
  await user.selectOptions(maxSizeUnitSelector, maxSizeGiBUnit);

  // root is with btrfs and snapshots, so it is not possible to select it
  await screen.findByText("Btrfs");
  await waitFor(() => (
    expect(screen.queryByRole("button", { name: "File system type" })).not.toBeInTheDocument())
  );

  await user.click(submitForm);

  expect(onSubmitFn).toHaveBeenCalledWith({
    ...volumes.root,
    minSize: parseToBytes("10 GiB"),
    maxSize: parseToBytes("25 GiB")
  });
});

describe("size validations", () => {
  describe("when 'Fixed' size is selected", () => {
    beforeEach(() => { props.volume = volumes.home });

    it("renders an error when size is not given", async () => {
      const { user } = plainRender(<VolumeFormWrapper volume={volumes.home} onSubmit={onSubmitFn} />);

      const submitForm = screen.getByRole("button", { name: "Submit VolumeForm" });
      const manualSize = screen.getByRole("radio", { name: "Fixed" });
      await user.click(manualSize);

      const sizeInput = screen.getByRole("textbox", { name: "Exact size" });
      await user.clear(sizeInput);
      await user.click(submitForm);
      screen.getByText("A size value is required");

      await user.type(sizeInput, "10");
      await user.click(submitForm);
      expect(screen.queryByText("A size value is required")).toBeNull();
    });
  });

  describe("when 'Range' size is selected", () => {
    beforeEach(() => { props.volume = volumes.home });

    it("renders an error when min size is not given", async () => {
      const { user } = plainRender(<VolumeFormWrapper volume={volumes.home} onSubmit={onSubmitFn} />);

      const submitForm = screen.getByRole("button", { name: "Submit VolumeForm" });
      const rangeSize = screen.getByRole("radio", { name: "Range" });
      await user.click(rangeSize);

      const minSizeInput = screen.getByRole("textbox", { name: "Minimum desired size" });

      await user.clear(minSizeInput);
      await user.click(submitForm);
      screen.getByText("Minimum size is required");

      await user.type(minSizeInput, "10");
      await user.click(submitForm);
      expect(screen.queryByText("Minimum size is required")).toBeNull();
    });

    it("renders an error when max size is smaller than or equal to min size", async () => {
      // Let's start the test without predefined sizes
      const volume = { ...volumes.home, minSize: "", maxSize: "" };
      const { user } = plainRender(<VolumeFormWrapper volume={volume} onSubmit={onSubmitFn} />);

      const submitForm = screen.getByRole("button", { name: "Submit VolumeForm" });
      const rangeSize = screen.getByRole("radio", { name: "Range" });
      await user.click(rangeSize);

      const minSizeInput = screen.getByRole("textbox", { name: "Minimum desired size" });
      const minSizeUnitSelector = screen.getByRole("combobox", { name: "Unit for the minimum size" });
      const minSizeMiBUnit = within(minSizeUnitSelector).getByRole("option", { name: "MiB" });
      const maxSizeInput = screen.getByRole("textbox", { name: "Maximum desired size" });
      const maxSizeUnitSelector = screen.getByRole("combobox", { name: "Unit for the maximum size" });
      const maxSizeGiBUnit = within(maxSizeUnitSelector).getByRole("option", { name: "GiB" });
      const maxSizeMiBUnit = within(maxSizeUnitSelector).getByRole("option", { name: "MiB" });

      // Max (11 GiB) > Min (10 GiB) BEFORE changing any unit size
      await user.clear(minSizeInput);
      await user.type(minSizeInput, "10");
      await user.clear(maxSizeInput);
      await user.type(maxSizeInput, "11");
      await user.click(submitForm);
      expect(screen.queryByText("Maximum must be greater than minimum")).toBeNull();

      // Max (10 GiB) === Min (10 GiB)
      await user.clear(maxSizeInput);
      await user.type(maxSizeInput, "10");
      await user.click(submitForm);
      screen.getByText("Maximum must be greater than minimum");

      // Max (10 MiB) < Min (10 GiB) because choosing a lower size unit
      await user.selectOptions(maxSizeUnitSelector, maxSizeMiBUnit);
      await user.click(submitForm);
      screen.getByText("Maximum must be greater than minimum");

      // Max (9 MiB) < Min (10 MiB) because choosing a lower size
      await user.selectOptions(minSizeUnitSelector, minSizeMiBUnit);
      await user.clear(maxSizeInput);
      await user.type(maxSizeInput, "9");
      await user.click(submitForm);
      screen.getByText("Maximum must be greater than minimum");

      // Max (11 MiB) > Min (10 MiB)
      await user.clear(maxSizeInput);
      await user.type(maxSizeInput, "11");
      await user.selectOptions(maxSizeUnitSelector, maxSizeGiBUnit);
    });
  });
});

describe("when editing a new volume", () => {
  beforeEach(() => { props.volume = volumes.root });

  it("renders the mount point", () => {
    plainRender(<VolumeForm {...props} />);

    screen.getByText("/");
  });

  it("does not render a control for changing the mount point", async () => {
    plainRender(<VolumeForm {...props} />);
    await waitFor(() => (
      expect(screen.queryByRole("button", { name: "Mount point" })).not.toBeInTheDocument()
    ));
  });
});

describe("when adding a new volume", () => {
  it("renders a control for setting the mount point", async () => {
    const { user } = plainRender(<VolumeForm {...props} />);

    let mountPointButton = screen.getByRole("button", { name: "Mount point" });
    await user.click(mountPointButton);
    screen.getByRole("option", { name: "/" });
    screen.getByRole("option", { name: "swap" });
    const homeMountPoint = screen.getByRole("option", { name: "/home" });
    await user.click(homeMountPoint);
    mountPointButton = screen.getByRole("button", { name: "Mount point" });
    await within(mountPointButton).findByText("/home");
  });
});
