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
import { screen, within, waitForElementToBeRemoved } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { ProposalActionsSection } from "~/components/storage";

jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: () => <div>PFSkeleton</div>
  };
});

const actions = [
  { text: 'Create GPT on /dev/vdc', subvol: false, delete: false },
  { text: 'Create partition /dev/vdc1 (8.00 MiB) as BIOS Boot Partition', subvol: false, delete: false },
  { text: 'Create encrypted partition /dev/vdc2 (29.99 GiB) as LVM physical volume', subvol: false, delete: false },
  { text: 'Create volume group system0 (29.98 GiB) with /dev/mapper/cr_vdc2 (29.99 GiB)', subvol: false, delete: false },
  { text: 'Create LVM logical volume /dev/system0/root (20.00 GiB) on volume group system0 for / with btrfs', subvol: false, delete: false },
];

const subvolumeActions = [
  { text: 'Create subvolume @ on /dev/system0/root (20.00 GiB)', subvol: true, delete: false },
  { text: 'Create subvolume @/var on /dev/system0/root (20.00 GiB)', subvol: true, delete: false },
  { text: 'Create subvolume @/usr/local on /dev/system0/root (20.00 GiB)', subvol: true, delete: false },
  { text: 'Create subvolume @/srv on /dev/system0/root (20.00 GiB)', subvol: true, delete: false },
  { text: 'Create subvolume @/root on /dev/system0/root (20.00 GiB)', subvol: true, delete: false },
  { text: 'Create subvolume @/opt on /dev/system0/root (20.00 GiB)', subvol: true, delete: false },
  { text: 'Create subvolume @/home on /dev/system0/root (20.00 GiB)', subvol: true, delete: false },
  { text: 'Create subvolume @/boot/writable on /dev/system0/root (20.00 GiB)', subvol: true, delete: false },
  { text: 'Create subvolume @/boot/grub2/x86_64-efi on /dev/system0/root (20.00 GiB)', subvol: true, delete: false },
  { text: 'Create subvolume @/boot/grub2/i386-pc on /dev/system0/root (20.00 GiB)', subvol: true, delete: false }
];

const destructiveAction = { text: 'Delete ext4 on /dev/vdc', subvol: false, delete: true };

it("renders skeleton while loading", () => {
  plainRender(<ProposalActionsSection isLoading actions={actions} />);

  screen.getAllByText(/PFSkeleton/);
});

it("renders nothing when there is no actions", () => {
  plainRender(<ProposalActionsSection actions={[]} />);

  expect(screen.queryAllByText(/Delete/)).toEqual([]);
  expect(screen.queryAllByText(/Create/)).toEqual([]);
  expect(screen.queryAllByText(/Show/)).toEqual([]);
});

describe("when there are actions", () => {
  it("renders an explanatory text", () => {
    plainRender(<ProposalActionsSection actions={actions} />);

    screen.getByText(/Actions to create/);
  });

  it("renders the list of actions", () => {
    plainRender(<ProposalActionsSection actions={actions} />);

    const actionsList = screen.getByRole("list");
    const actionsListItems = within(actionsList).getAllByRole("listitem");
    expect(actionsListItems.map(i => i.textContent)).toEqual(actions.map(a => a.text));
  });

  describe("when there is a destructive action", () => {
    it("emphasizes the action", () => {
      plainRender(<ProposalActionsSection actions={[destructiveAction, ...actions]} />);

      // https://stackoverflow.com/a/63080940
      const actionItems = screen.getAllByRole("listitem");
      const destructiveActionItem = actionItems.find(item => item.textContent === destructiveAction.text);

      expect(destructiveActionItem).toHaveClass("proposal-action--delete");
    });
  });

  describe("when there are subvolume actions", () => {
    it("does not render the subvolume actions", () => {
      plainRender(<ProposalActionsSection actions={[...actions, ...subvolumeActions]} />);

      // For now, we know that there are two lists and the subvolume list is the second one.
      // The test could be simplified once we have aria-descriptions for the lists.
      const [genericList, subvolList] = screen.getAllByRole("list", { hidden: true });
      expect(genericList).not.toBeNull();
      expect(subvolList).not.toBeNull();
      const subvolItems = within(subvolList).queryAllByRole("listitem");
      expect(subvolItems).toEqual([]);
    });

    it("renders the subvolume actions after clicking on 'show subvolumes'", async () => {
      const { user } = plainRender(
        <ProposalActionsSection actions={[...actions, ...subvolumeActions]} />
      );

      const link = screen.getByText(/Show.*subvolume actions/);

      expect(screen.getAllByRole("list").length).toEqual(1);

      await user.click(link);

      waitForElementToBeRemoved(link);
      screen.getByText(/Hide.*subvolume actions/);

      // For now, we know that there are two lists and the subvolume list is the second one.
      // The test could be simplified once we have aria-descriptions for the lists.
      const [, subvolList] = screen.getAllByRole("list");
      const subvolItems = within(subvolList).getAllByRole("listitem");

      expect(subvolItems.map(i => i.textContent)).toEqual(subvolumeActions.map(a => a.text));
    });
  });
});
