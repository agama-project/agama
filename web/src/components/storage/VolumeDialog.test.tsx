/*
 * Copyright (c) [2004] SUSE LLC
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
import { screen, waitFor, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { parseToBytes } from "~/components/storage/utils";
import VolumeDialog, { VolumeDialogProps } from "./VolumeDialog";
import { Volume, VolumeTarget } from "~/types/storage";

const rootVolume: Volume = {
  mountPath: "/",
  target: VolumeTarget.DEFAULT,
  fsType: "Btrfs",
  minSize: 1024,
  maxSize: 2048,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: true,
    fsTypes: ["Btrfs", "Ext4"],
    supportAutoSize: true,
    snapshotsConfigurable: true,
    snapshotsAffectSizes: true,
    sizeRelevantVolumes: [],
    adjustByRam: false,
    productDefined: true,
  },
};

const swapVolume: Volume = {
  mountPath: "swap",
  target: VolumeTarget.DEFAULT,
  fsType: "Swap",
  minSize: 1024,
  maxSize: 1024,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: false,
    fsTypes: ["Swap"],
    supportAutoSize: false,
    snapshotsConfigurable: false,
    snapshotsAffectSizes: false,
    adjustByRam: false,
    sizeRelevantVolumes: [],
    productDefined: true,
  },
};

const homeVolume: Volume = {
  mountPath: "/home",
  target: VolumeTarget.DEFAULT,
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

const arbitraryVolume: Volume = {
  mountPath: "",
  target: VolumeTarget.DEFAULT,
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
    productDefined: false,
  },
};

let props: VolumeDialogProps;

describe("VolumeDialog", () => {
  beforeEach(() => {
    props = {
      volume: undefined,
      volumes: [],
      templates: [],
      isOpen: true,
      onCancel: jest.fn(),
      onAccept: jest.fn(),
    };
  });

  describe("when adding a new volume", () => {
    describe("predefined by the product", () => {
      it("does not allow settings the mount point", () => {
        plainRender(<VolumeDialog {...props} volume={homeVolume} />);
        expect(screen.queryByRole("textbox", { name: "Mount point" })).toBeNull();
      });
    });

    describe("not predefined by the product", () => {
      it("allows setting the mount point", async () => {
        const { user } = plainRender(<VolumeDialog {...props} volume={arbitraryVolume} />);
        const mountPointInput = screen.getByRole("textbox", { name: "Mount point" });
        const submit = screen.getByRole("button", { name: "Accept" });
        await user.type(mountPointInput, "/var/log");
        await user.click(submit);
        expect(props.onAccept).toHaveBeenCalledWith(
          expect.objectContaining({ mountPath: "/var/log" }),
        );
      });
    });

    it("renders a file system picker if it allows more than one", async () => {
      const { user } = plainRender(<VolumeDialog {...props} volume={homeVolume} />);
      const fsTypeButton = screen.getByRole("button", { name: "File system type" });
      await user.click(fsTypeButton);
      screen.getByRole("option", { name: "XFS" });
      screen.getByRole("option", { name: "Ext4" });
    });

    it("does not render a file system picker when it accepts only one", async () => {
      plainRender(<VolumeDialog {...props} volume={swapVolume} />);
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "File system type" })).not.toBeInTheDocument(),
      );
    });

    it("renders 'Auto', 'Fixed', and 'Range' size options when volume supports auto size", () => {
      plainRender(<VolumeDialog {...props} volume={rootVolume} />);
      screen.getByRole("radio", { name: "Auto" });
      screen.getByRole("radio", { name: "Fixed" });
      screen.getByRole("radio", { name: "Range" });
    });

    it("renders only 'Fixed' and 'Range' size options if volume does not support auto size", () => {
      plainRender(<VolumeDialog {...props} volume={homeVolume} />);
      expect(screen.queryByRole("radio", { name: "Auto" })).toBeNull();
      screen.getByRole("radio", { name: "Fixed" });
      screen.getByRole("radio", { name: "Range" });
    });

    it("uses the min size unit as max size unit when it is missing", () => {
      plainRender(
        <VolumeDialog {...props} volume={{ ...homeVolume, minSize: 1.1e12, maxSize: undefined }} />,
      );
      const maxSizeUnitSelector = screen.getByRole("combobox", {
        name: "Unit for the maximum size",
      });
      expect(maxSizeUnitSelector).toHaveValue("TiB");
    });
  });

  describe("when editing a volume", () => {
    beforeEach(() => {
      props = { ...props, volumes: [rootVolume, homeVolume, swapVolume, arbitraryVolume] };
    });

    it("does not allow changing the mount point", () => {
      const { rerender } = plainRender(<VolumeDialog {...props} volume={arbitraryVolume} />);
      expect(screen.queryByRole("textbox", { name: "Mount point" })).toBeNull();
      rerender(<VolumeDialog {...props} volume={homeVolume} />);
      expect(screen.queryByRole("textbox", { name: "Mount point" })).toBeNull();
    });

    it("renders a file system picker if it allows more than one", async () => {
      const { user } = plainRender(<VolumeDialog {...props} volume={homeVolume} />);
      const fsTypeButton = screen.getByRole("button", { name: "File system type" });
      await user.click(fsTypeButton);
      screen.getByRole("option", { name: "XFS" });
      screen.getByRole("option", { name: "Ext4" });
    });

    it("does not render a file system picker when it accepts only one", async () => {
      plainRender(<VolumeDialog {...props} volume={swapVolume} />);
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "File system type" })).not.toBeInTheDocument(),
      );
    });

    it("renders 'Auto', 'Fixed', and 'Range' size options when volume supports auto size", () => {
      plainRender(<VolumeDialog {...props} volume={rootVolume} />);
      screen.getByRole("radio", { name: "Auto" });
      screen.getByRole("radio", { name: "Fixed" });
      screen.getByRole("radio", { name: "Range" });
    });

    it("renders only 'Fixed' and 'Range' size options if volume does not support auto size", () => {
      plainRender(<VolumeDialog {...props} volume={homeVolume} />);
      expect(screen.queryByRole("radio", { name: "Auto" })).toBeNull();
      screen.getByRole("radio", { name: "Fixed" });
      screen.getByRole("radio", { name: "Range" });
    });

    it("uses the min size unit as max size unit when it is missing", () => {
      plainRender(
        <VolumeDialog {...props} volume={{ ...homeVolume, minSize: 1.1e12, maxSize: undefined }} />,
      );
      const maxSizeUnitSelector = screen.getByRole("combobox", {
        name: "Unit for the maximum size",
      });
      expect(maxSizeUnitSelector).toHaveValue("TiB");
    });
  });

  it("calls the onAccept callback with resulting volume when the form is submitted", async () => {
    const { user } = plainRender(<VolumeDialog {...props} volume={rootVolume} />);
    const submit = screen.getByRole("button", { name: "Accept" });
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

    await user.click(submit);

    expect(props.onAccept).toHaveBeenCalledWith({
      ...rootVolume,
      autoSize: false,
      minSize: parseToBytes("10 GiB"),
      maxSize: parseToBytes("25 GiB"),
    });
  });

  it("does not call the onAccept callback when the form is not submitted", async () => {
    const { user } = plainRender(<VolumeDialog {...props} volume={rootVolume} />);
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);
    expect(props.onAccept).not.toHaveBeenCalled();
    expect(props.onCancel).toHaveBeenCalled();
  });

  describe("mount point validations", () => {
    it("warns and helps user when entered mount path included in a not existing but predefined volume", async () => {
      const { user } = plainRender(
        <VolumeDialog {...props} templates={[homeVolume]} volume={arbitraryVolume} />,
      );
      const mountPointInput = screen.getByRole("textbox", { name: "Mount point" });
      await user.type(mountPointInput, "/home");
      await screen.findByText("There is a predefined file system for /home.");
      const addButton = screen.getByRole("button", { name: "Do you want to add it?" });
      await user.click(addButton);
      screen.getByRole("heading", { name: "Add /home file system" });
      expect(screen.queryByRole("textbox", { name: "Mount point" })).toBeNull();
      screen.getByText("/home");
    });

    it("warns and helps user when entered mount path including in an existing volume", async () => {
      const { user } = plainRender(
        <VolumeDialog {...props} volumes={[rootVolume, swapVolume]} volume={arbitraryVolume} />,
      );
      const mountPointInput = screen.getByRole("textbox", { name: "Mount point" });
      await user.type(mountPointInput, "swap");
      await screen.findByText("There is already a file system for swap.");
      const editButton = screen.getByRole("button", { name: "Do you want to edit it?" });
      await user.click(editButton);
      screen.getByRole("heading", { name: "Edit swap file system" });
      expect(screen.queryByRole("textbox", { name: "Mount point" })).toBeNull();
      screen.getByText("swap");
    });

    it("renders an error if a not valid path was given", async () => {
      const { user } = plainRender(<VolumeDialog {...props} volume={arbitraryVolume} />);
      const mountPointInput = screen.getByRole("textbox", { name: "Mount point" });
      const submitButton = screen.getByRole("button", { name: "Accept" });

      // No mount point given
      await user.click(submitButton);
      screen.getByText("A mount point is required");

      // Without starting backslash
      await user.clear(mountPointInput);
      await user.type(mountPointInput, "var/log");
      await user.click(submitButton);
      screen.getByText("The mount point is invalid");

      // With more than one leading backslash
      await user.clear(mountPointInput);
      await user.type(mountPointInput, "//var/log/");
      await user.click(submitButton);
      screen.getByText("The mount point is invalid");

      // With more than one trailing backslash
      await user.clear(mountPointInput);
      await user.type(mountPointInput, "/var/log//");
      await user.click(submitButton);
      screen.getByText("The mount point is invalid");
    });
  });

  describe("size validations", () => {
    describe("when 'Fixed' size is selected", () => {
      it("renders an error when size is not given", async () => {
        const { user } = plainRender(<VolumeDialog {...props} volume={homeVolume} />);
        const submitButton = screen.getByRole("button", { name: "Accept" });
        const fixedSizeOption = screen.getByRole("radio", { name: "Fixed" });
        await user.click(fixedSizeOption);
        const sizeInput = screen.getByRole("textbox", { name: "Exact size" });
        await user.clear(sizeInput);
        await user.click(submitButton);
        screen.getByText("A size value is required");
        await user.type(sizeInput, "10");
        await user.click(submitButton);
        expect(screen.queryByText("A size value is required")).toBeNull();
      });
    });

    describe("when 'Range' size is selected", () => {
      it("renders an error when min size is not given", async () => {
        const { user } = plainRender(<VolumeDialog {...props} volume={homeVolume} />);

        const submitButton = screen.getByRole("button", { name: "Accept" });
        const rangeSize = screen.getByRole("radio", { name: "Range" });
        await user.click(rangeSize);

        const minSizeInput = screen.getByRole("textbox", { name: "Minimum desired size" });

        await user.clear(minSizeInput);
        await user.click(submitButton);
        screen.getByText("Minimum size is required");

        await user.type(minSizeInput, "10");
        await user.click(submitButton);
        expect(screen.queryByText("Minimum size is required")).toBeNull();
      });

      it("renders an error when max size is smaller than or equal to min size", async () => {
        const volume = { ...homeVolume, minSize: undefined, maxSize: undefined };
        const { user } = plainRender(<VolumeDialog {...props} volume={volume} />);
        const submitButton = screen.getByRole("button", { name: "Accept" });
        const rangeSize = screen.getByRole("radio", { name: "Range" });
        await user.click(rangeSize);

        const minSizeInput = screen.getByRole("textbox", { name: "Minimum desired size" });
        const minSizeUnitSelector = screen.getByRole("combobox", {
          name: "Unit for the minimum size",
        });
        const minSizeMiBUnit = within(minSizeUnitSelector).getByRole("option", { name: "MiB" });
        const maxSizeInput = screen.getByRole("textbox", { name: "Maximum desired size" });
        const maxSizeUnitSelector = screen.getByRole("combobox", {
          name: "Unit for the maximum size",
        });
        const maxSizeGiBUnit = within(maxSizeUnitSelector).getByRole("option", { name: "GiB" });
        const maxSizeMiBUnit = within(maxSizeUnitSelector).getByRole("option", { name: "MiB" });

        // Max (11 GiB) > Min (10 GiB) BEFORE changing any unit size
        await user.clear(minSizeInput);
        await user.type(minSizeInput, "10");
        await user.clear(maxSizeInput);
        await user.type(maxSizeInput, "11");
        await user.click(submitButton);
        expect(screen.queryByText("Maximum must be greater than minimum")).toBeNull();

        // Max (10 GiB) === Min (10 GiB)
        await user.clear(maxSizeInput);
        await user.type(maxSizeInput, "10");
        await user.click(submitButton);
        screen.getByText("Maximum must be greater than minimum");

        // Max (10 MiB) < Min (10 GiB) because choosing a lower size unit
        await user.selectOptions(maxSizeUnitSelector, maxSizeMiBUnit);
        await user.click(submitButton);
        screen.getByText("Maximum must be greater than minimum");

        // Max (9 MiB) < Min (10 MiB) because choosing a lower size
        await user.selectOptions(minSizeUnitSelector, minSizeMiBUnit);
        await user.clear(maxSizeInput);
        await user.type(maxSizeInput, "9");
        await user.click(submitButton);
        screen.getByText("Maximum must be greater than minimum");

        // Max (11 MiB) > Min (10 MiB)
        await user.clear(maxSizeInput);
        await user.type(maxSizeInput, "11");
        await user.selectOptions(maxSizeUnitSelector, maxSizeGiBUnit);
      });
    });
  });
});
