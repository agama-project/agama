/*
 * Copyright (c) [2022] SUSE LLC
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
import { screen, waitFor, within, waitForElementToBeRemoved } from "@testing-library/react";
import { installerRender } from "@test-utils/renderers";
import { ProposalActions } from "@components/storage";

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

describe("ProposalActions", () => {
  describe("when there is none action", () => {
    it("renders nothing", async () => {
      const { container } = installerRender(<ProposalActions actions={[]} />, { usingLayout: false });

      await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
  });

  describe("when there are actions", () => {
    it("renders an explanatory text", () => {
      installerRender(
        <ProposalActions actions={actions} />
      );

      screen.getByText(/Actions to perform/);
    });

    it("renders a list of actions", () => {
      installerRender(
        <ProposalActions actions={actions} />
      );

      const actionsList = screen.getByRole("list");
      const actionsListItems = within(actionsList).getAllByRole("listitem");
      expect(actionsListItems.map(i => i.textContent)).toEqual(actions.map(a => a.text));
    });

    describe("when there is a destructive action", () => {
      it("emphatizes it", () => {
        installerRender(
          <ProposalActions actions={[destructiveAction, ...actions]} />
        );

        // https://stackoverflow.com/a/63080940
        const actionItems = screen.getAllByRole("listitem");
        const destructiveActionItem = actionItems.find(item => item.textContent === destructiveAction.text);

        expect(destructiveActionItem).toHaveClass("proposal-action--delete");
      });
    });

    describe("when there are subvolume actions", () => {
      it("renders them collapsed", () => {
        installerRender(
          <ProposalActions actions={[...actions, ...subvolumeActions]} />
        );

        // By now, we know that there are two list and subvolume actions is the latest one.
        // Once we have aria-descriptions for them test could be simplified.
        const visibleLists = screen.getAllByRole("list");
        const hiddenLists = screen.getAllByRole("list", { hidden: true });

        expect(visibleLists.length).toEqual(1);
        expect(hiddenLists.length).toEqual(2);

        const hiddenItems = within(hiddenLists[1]).getAllByRole("listitem", { hidden: true });

        expect(hiddenItems.map(i => i.textContent)).toEqual(subvolumeActions.map(a => a.text));
      });

      it("renders them expanded after user clicks on 'show subvolumes' link", async () => {
        const { user } = installerRender(
          <ProposalActions actions={[...actions, ...subvolumeActions]} />
        );

        const link = screen.getByText(/Show.*subvolumes actions/);

        let visibleLists = screen.getAllByRole("list");
        expect(visibleLists.length).toEqual(1);

        await user.click(link);

        waitForElementToBeRemoved(link);
        screen.getByText(/Hide.*subvolumes actions/);

        visibleLists = screen.getAllByRole("list");
        expect(visibleLists.length).toEqual(2);

        // By now, we know that there are two list and subvolume actions is the latest one.
        // Once we have aria-descriptions for them test could be simplified.
        const subvolumesList = visibleLists[1];
        const subvolumesItems = within(subvolumesList).getAllByRole("listitem");

        expect(subvolumesItems.map(i => i.textContent)).toEqual(subvolumeActions.map(a => a.text));
      });
    });
  });
});
