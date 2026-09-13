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
import { Button, Flex, HelperText, HelperTextItem } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import { useRetarget } from "~/components/storage/shared/use-retarget";
import { _ } from "~/i18n";
import type { Partitionable } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";

export type RetargetOfferProps = {
  /** The device the plan would move off, as the configuration describes it. */
  entry: Partitionable.Device;
  /** The same device as the machine reports it, where the machine has it. */
  device: Storage.Device | null;
  /**
   * How much weight it carries. It answers the sentence the page opens with, so
   * it leads there; beside the content it would move, it is one offer among
   * several.
   */
  variant?: "primary" | "secondary";
};

/**
 * Putting the installation somewhere else, offered where the page has named
 * one device and said what it will hold.
 *
 * That sentence raises one question about the disk, which is whether it is the
 * right one, and this is the act that answers it. So it leads the row and
 * carries the weight; adding a second device is a different plan rather than an
 * answer to this one, and sits plain beside it.
 *
 * The mark travels with the offer, so the same act is recognizable wherever it
 * is made. It is laid out beside the words rather than through the button's own
 * icon slot, which sets it smaller and on the text's baseline: next to the menu
 * that lays its mark out the first way, the two read as a pair of different
 * things rather than as two offers of the same kind.
 *
 * Where the plan cannot move, the button keeps its name and says why underneath,
 * and stays reachable: a control the browser disables is skipped by keyboard
 * and screen reader, so the explanation written for that reader is never met.
 */
export default function RetargetOffer({
  entry,
  device,
  variant = "primary",
}: RetargetOfferProps): React.ReactNode {
  const { cannotMove, open, selector } = useRetarget(entry, device);
  const reasonId = React.useId();

  return (
    <>
      <Flex direction={{ default: "column" }} gap={{ default: "gapXs" }}>
        <Button
          variant={variant}
          isAriaDisabled={cannotMove !== null}
          aria-describedby={cannotMove ? reasonId : undefined}
          onClick={cannotMove ? undefined : open}
        >
          <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
            <Icon name="change_circle" />{" "}
            {/* TRANSLATORS: offered under the summary of an installation on one
                device: put it somewhere else instead. */}
            {_("Use another device")}
          </Flex>
        </Button>
        {cannotMove && (
          <HelperText>
            <HelperTextItem id={reasonId}>{cannotMove}</HelperTextItem>
          </HelperText>
        )}
      </Flex>
      {selector}
    </>
  );
}
