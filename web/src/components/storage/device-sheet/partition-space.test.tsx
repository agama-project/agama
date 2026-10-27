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
import { screen } from "@testing-library/react";
import { Menu, MenuContent, MenuList } from "@patternfly/react-core";
import { installerRender, plainRender } from "~/test-utils";
import type { Storage as System } from "~/model/system";
import type { Decision } from "~/components/storage/device-sheet/partition-space";
import {
  shrinkReason,
  ShrinkRefusal,
  usePartitionSpaceItems,
} from "~/components/storage/device-sheet/partition-space";

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => null,
  useSetSpacePolicy: () => jest.fn(),
}));

const GiB = 1024 ** 3;

/** A partition the machine already has, with what it says about shrinking it. */
const partition = (shrinking: System.Device["block"]["shrinking"]): System.Device => ({
  sid: 41,
  name: "/dev/vda1",
  class: "partition",
  block: { start: 0, size: 80 * GiB, shrinking } as System.Device["block"],
});

describe("shrinkReason", () => {
  it("gives only the first reason, however many there are", () => {
    expect(
      shrinkReason(
        partition({
          supported: false,
          reasons: ["The file system is full.", "A password is required."],
        }),
      ),
    ).toBe("The file system is full.");
  });

  it("gives nothing where the machine gives no reason", () => {
    expect(shrinkReason(partition({ supported: false, reasons: [] }))).toBeUndefined();
  });
});

describe("ShrinkRefusal", () => {
  it("reads a single reason as one sentence", () => {
    plainRender(
      <ShrinkRefusal
        partition={partition({ supported: false, reasons: ["The file system is full."] })}
      />,
    );

    screen.getByText("The file system is full.");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("reads only the first of several reasons", () => {
    plainRender(
      <ShrinkRefusal
        partition={partition({
          supported: false,
          reasons: ["The file system is full.", "A password is required."],
        })}
      />,
    );

    screen.getByText("The file system is full.");
    expect(screen.queryByText("A password is required.")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("offers nothing to open or close, however many reasons there are", () => {
    plainRender(
      <ShrinkRefusal
        partition={partition({ supported: false, reasons: ["One.", "Two.", "Three."] })}
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("still answers where the machine gives no reason", () => {
    plainRender(<ShrinkRefusal partition={partition({ supported: false, reasons: [] })} />);

    screen.getByText("This partition cannot be made smaller.");
  });
});

describe("usePartitionSpaceItems", () => {
  const shrinkable = { ...partition({ supported: true, minSize: 20 * GiB }), name: "/dev/vda2" };
  const unshrinkable = partition({ supported: false });

  function Items({ part, rule }: { part: System.Device; rule?: Decision }) {
    const items = usePartitionSpaceItems({
      partition: part,
      governed: [unshrinkable, shrinkable],
      entries: [],
      collection: "drives",
      index: 0,
      rule,
    });

    return (
      <Menu>
        <MenuContent>
          <MenuList>{items}</MenuList>
        </MenuContent>
      </Menu>
    );
  }

  it("marks as taken the decision the device gives every partition", () => {
    installerRender(<Items part={shrinkable} rule="resizeIfNeeded" />);

    expect(screen.getByRole("menuitem", { name: /^Shrink if needed/ })).toHaveClass(
      "pf-m-selected",
    );
  });

  it("marks keeping as taken where shrinking is allowed but impossible", () => {
    installerRender(<Items part={unshrinkable} rule="resizeIfNeeded" />);

    expect(screen.getByRole("menuitem", { name: /^Keep/ })).toHaveClass("pf-m-selected");
    expect(screen.getByRole("menuitem", { name: /^Shrink if needed/ })).not.toHaveClass(
      "pf-m-selected",
    );
  });
});
