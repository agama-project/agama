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
import { screen, within } from "@testing-library/react";
import { mockComponent, plainRender } from "~/test-utils";
import { ProposalVolumes } from "~/components/storage";

jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: mockComponent("PFSkeleton")
  };
});

const volumes = {
  root: {
    mountPoint: "/",
    optional: false,
    deviceType: "partition",
    encrypted: false,
    minSize: 1024,
    maxSize: 2048,
    adaptiveSizes: false,
    fixedSizeLimits: true,
    fsType: "Btrfs",
    snapshots: true
  },
  home: {
    mountPoint: "/home",
    optional: true,
    deviceType: "partition",
    encrypted: false,
    minSize: 1024,
    maxSize: 2048,
    adaptiveSizes: false,
    fixedSizeLimits: true,
    fsType: "XFS",
    snapshots: false
  }
};

let props;

beforeEach(() => {
  props = {};
});

it("renders a button for the generic actions", async () => {
  const { user } = plainRender(<ProposalVolumes {...props} />);

  const button = screen.getByRole("button", { name: "Actions" });
  await user.click(button);

  const menu = screen.getByRole("menu");
  within(menu).getByRole("menuitem", { name: /Reset/ });
  within(menu).getByRole("menuitem", { name: /Add/ });
});

it("changes the volumes if reset action is used", async () => {
  props.onChange = jest.fn();

  const { user } = plainRender(<ProposalVolumes {...props} />);

  const button = screen.getByRole("button", { name: "Actions" });
  await user.click(button);
  const menu = screen.getByRole("menu");
  const reset = within(menu).getByRole("menuitem", { name: /Reset/ });
  await user.click(reset);

  expect(props.onChange).toHaveBeenCalledWith([]);
});

it("allows to add a volume if add action is used", async () => {
  props.templates = [volumes.home];
  props.onChange = jest.fn();

  const { user } = plainRender(<ProposalVolumes {...props} />);

  const button = screen.getByRole("button", { name: "Actions" });
  await user.click(button);
  const menu = screen.getByRole("menu");
  const add = within(menu).getByRole("menuitem", { name: /Add/ });
  await user.click(add);

  const popup = await screen.findByRole("dialog");
  const accept = within(popup).getByRole("button", { name: "Accept" });
  await user.click(accept);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(props.onChange).toHaveBeenCalledWith([props.templates[0]]);
});

it("allows to cancel if add action is used", async () => {
  props.templates = [volumes.home];
  props.onChange = jest.fn();

  const { user } = plainRender(<ProposalVolumes {...props} />);

  const button = screen.getByRole("button", { name: "Actions" });
  await user.click(button);
  const menu = screen.getByRole("menu");
  const add = within(menu).getByRole("menuitem", { name: /Add/ });
  await user.click(add);

  const popup = await screen.findByRole("dialog");
  const cancel = within(popup).getByRole("button", { name: "Cancel" });
  await user.click(cancel);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(props.onChange).not.toHaveBeenCalled();
});

describe("if there are volumes", () => {
  beforeEach(() => {
    props.volumes = [volumes.root, volumes.home];
  });

  it("renders skeleton for each volume if loading", async () => {
    props.isLoading = true;

    plainRender(<ProposalVolumes {...props} />);

    const [, body] = await screen.findAllByRole("rowgroup");

    const rows = within(body).getAllByRole("row");
    expect(rows.length).toEqual(2);

    const loadingRows = within(body).getAllByRole("row", { name: "PFSkeleton" });
    expect(loadingRows.length).toEqual(2);
  });

  it("renders the information for each volume", async () => {
    plainRender(<ProposalVolumes {...props} />);

    const [, body] = await screen.findAllByRole("rowgroup");

    expect(within(body).queryAllByRole("row").length).toEqual(2);
    within(body).getByRole("row", { name: "/ Btrfs partition with snapshots 1 KiB - 2 KiB" });
    within(body).getByRole("row", { name: "/home XFS partition 1 KiB - 2 KiB" });
  });

  it("allows deleting the volume", async () => {
    props.onChange = jest.fn();

    const { user } = plainRender(<ProposalVolumes {...props} />);

    const [, body] = await screen.findAllByRole("rowgroup");
    const row = within(body).getByRole("row", { name: "/home XFS partition 1 KiB - 2 KiB" });
    const actions = within(row).getByRole("button", { name: "Actions" });
    await user.click(actions);
    const deleteAction = within(row).queryByRole("menuitem", { name: "Delete" });
    await user.click(deleteAction);

    expect(props.onChange).toHaveBeenCalledWith(expect.not.arrayContaining([volumes.home]));
  });

  it("allows editing the volume", async () => {
    props.onChange = jest.fn();

    const { user } = plainRender(<ProposalVolumes {...props} />);

    const [, body] = await screen.findAllByRole("rowgroup");
    const row = within(body).getByRole("row", { name: "/home XFS partition 1 KiB - 2 KiB" });
    const actions = within(row).getByRole("button", { name: "Actions" });
    await user.click(actions);
    const editAction = within(row).queryByRole("menuitem", { name: "Edit" });
    await user.click(editAction);

    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Edit file system");
    const mountPointSelector = within(popup).getByRole("combobox", { name: "mount point" });
    expect(mountPointSelector).toHaveAttribute("disabled");
  });
});

describe("if there are not volumes", () => {
  beforeEach(() => {
    props.volumes = [];
  });

  it("renders an empty table if it is not loading", async () => {
    plainRender(<ProposalVolumes {...props} />);

    const [, body] = await screen.findAllByRole("rowgroup");
    expect(body).toBeEmptyDOMElement();
  });

  it("renders an skeleton row if it is loading", async () => {
    props.isLoading = true;

    plainRender(<ProposalVolumes {...props} />);

    const [, body] = await screen.findAllByRole("rowgroup");
    const rows = within(body).getAllByRole("row", { name: "PFSkeleton" });

    expect(rows.length).toEqual(1);
  });
});
