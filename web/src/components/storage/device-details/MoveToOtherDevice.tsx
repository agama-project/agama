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
import { Button, Flex } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import { useRetarget } from "~/components/storage/shared/use-retarget";
import { _ } from "~/i18n";
import type { Partitionable } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";

export type MoveToOtherDeviceProps = {
  /** The device the content would move off, as the configuration has it. */
  entry: Partitionable.Device;
  /** The same device as the machine reports it, where the machine has it. */
  device: Storage.Device | null;
};

/**
 * Taking what is planned here and putting it somewhere else, offered under the
 * list of what that is.
 *
 * Plain rather than leading, and offered only where the list has something in
 * it. Beside a table that has just said what the device will hold, this is one
 * thing to do about the device among several, not the point of the view; and
 * under a view that has just said nothing is planned, it would promise the move
 * of nothing.
 *
 * The mark travels with the offer, so the same act is recognizable wherever it
 * is made. It is laid out beside the words rather than through the button's own
 * icon slot, which sets it smaller and on the text's baseline: next to the menu
 * that lays its mark out the first way, the two read as a pair of different
 * things rather than as two offers of the same kind.
 *
 * A plain button, as "Add more devices" is: it opens a dialog rather than
 * leading to a form, so it is not drawn as the links beside it are, and it
 * does not compete with them as an outlined button would.
 *
 * Always open. Whether the move can be made is settled in the dialog it opens,
 * which is where the reader sees what there is to move to; a button that knows
 * the answer in advance is a button that has to explain itself before the
 * reader has asked anything.
 *
 * It is the page's {@link ChangeInstallationDisk} in a different place and
 * nothing more today. They are two components because they are heading apart:
 * that one is about where the installation goes, this one about where some part
 * of it goes, and only the first of those is the whole plan.
 */
export default function MoveToOtherDevice({
  entry,
  device,
}: MoveToOtherDeviceProps): React.ReactNode {
  const { open, selector } = useRetarget(entry, device);

  return (
    <>
      <Button variant="plain" onClick={open}>
        <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
          <Icon name="move_down" />{" "}
          {
            // TRANSLATORS: offered under the list of what a device will hold:
            // move all of it to a different device.
            _("Move to other device")
          }
        </Flex>
      </Button>
      {selector}
    </>
  );
}
