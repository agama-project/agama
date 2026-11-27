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
import type { Decision } from "~/components/storage/device-details/partition-space";
import {
  shrinkReason,
  ShrinkRefusal,
  usePartitionSpaceItems,
} from "~/components/storage/device-details/partition-space";

const mockSetSpacePolicy = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => null,
  useSetSpacePolicy: () => mockSetSpacePolicy,
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

describe("ShrinkRefusal on a logical volume", () => {
  it("answers in terms of logical volumes where the machine gives no reason", () => {
    plainRender(
      <ShrinkRefusal
        partition={partition({ supported: false, reasons: [] })}
        kind="logicalVolume"
      />,
    );

    screen.getByText("This logical volume cannot be made smaller.");
  });

  it("still shows the machine's reason", () => {
    plainRender(
      <ShrinkRefusal
        partition={partition({ supported: false, reasons: ["The file system is full."] })}
        kind="logicalVolume"
      />,
    );

    screen.getByText("The file system is full.");
  });
});

describe("usePartitionSpaceItems", () => {
  const shrinkable = { ...partition({ supported: true, minSize: 20 * GiB }), name: "/dev/vda2" };
  const unshrinkable = partition({ supported: false });

  beforeEach(() => {
    mockSetSpacePolicy.mockClear();
  });

  function Items({
    part,
    rule,
    collection = "drives",
    governed = [unshrinkable, shrinkable],
    entries = [],
  }: {
    part: System.Device;
    rule?: Decision;
    collection?: "drives" | "volumeGroups";
    governed?: System.Device[];
    entries?: React.ComponentProps<typeof usePartitionSpaceItems>["entries"];
  }) {
    const items = usePartitionSpaceItems({
      partition: part,
      governed,
      entries,
      collection,
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

  it("marks nothing as taken even if the decision matches the value", () => {
    installerRender(<Items part={shrinkable} rule="resizeIfNeeded" />);

    expect(screen.getByRole("menuitem", { name: /^Shrink if needed/ })).not.toHaveClass(
      "pf-m-selected",
    );
  });

  it("marks nothing as taken where shrinking is allowed by the user but impossible", () => {
    installerRender(<Items part={unshrinkable} rule="resizeIfNeeded" />);

    expect(screen.getByRole("menuitem", { name: /^Do not modify/ })).not.toHaveClass(
      "pf-m-selected",
    );
    expect(screen.getByRole("menuitem", { name: /^Shrink if needed/ })).not.toHaveClass(
      "pf-m-selected",
    );
  });

  describe("on the logical volumes of a volume group", () => {
    it("speaks of logical volumes when offering to delete", () => {
      installerRender(<Items part={shrinkable} collection="volumeGroups" />);

      expect(screen.getByRole("menuitem", { name: /^Delete/ })).toHaveTextContent(
        "freed for new logical volumes",
      );
    });

    it("speaks of logical volumes when offering to shrink", () => {
      installerRender(<Items part={shrinkable} collection="volumeGroups" />);

      expect(screen.getByRole("menuitem", { name: /^Shrink if needed/ })).toHaveTextContent(
        "may be freed for new logical volumes",
      );
    });

    it("says a logical volume cannot be made smaller, where it cannot", () => {
      installerRender(<Items part={unshrinkable} collection="volumeGroups" />);

      expect(screen.getByRole("menuitem", { name: /^Shrink if needed/ })).toHaveTextContent(
        "This logical volume cannot be made smaller.",
      );
    });

    it("keeps speaking of partitions on a disk", () => {
      installerRender(<Items part={shrinkable} />);

      expect(screen.getByRole("menuitem", { name: /^Delete/ })).toHaveTextContent(
        "freed for new partitions",
      );
      expect(screen.getByRole("menuitem", { name: /^Shrink if needed/ })).toHaveTextContent(
        "may be freed for new partitions",
      );
    });
  });

  describe("choosing for a partition the new system does not use", () => {
    it("writes the decisions of the governed partitions, releasing nothing", async () => {
      const { user } = installerRender(<Items part={shrinkable} />);
      await user.click(screen.getByRole("menuitem", { name: /^Delete/ }));

      expect(mockSetSpacePolicy).toHaveBeenCalledWith("drives", 0, {
        type: "custom",
        actions: [{ deviceName: "/dev/vda2", value: "delete" }],
        release: undefined,
      });
    });
  });

  describe.each([
    ["partition", "drives", "/dev/vda2"],
    ["logical volume", "volumeGroups", "/dev/vda2"],
  ] as const)("choosing for a reused %s", (_kind, collection, name) => {
    /* Reused ones are not governed: the configuration stores their use. */
    const entries = [{ name, mountPath: "/home" }];
    const other = { ...unshrinkable, name: "/dev/vda3" };
    const others = [other];

    it("releases it and deletes it", async () => {
      const { user } = installerRender(
        <Items part={shrinkable} collection={collection} governed={others} entries={entries} />,
      );
      await user.click(screen.getByRole("menuitem", { name: /^Delete/ }));

      expect(mockSetSpacePolicy).toHaveBeenCalledWith(collection, 0, {
        type: "custom",
        actions: [{ deviceName: name, value: "delete" }],
        release: name,
      });
    });

    it("releases it and shrinks it if needed", async () => {
      const { user } = installerRender(
        <Items part={shrinkable} collection={collection} governed={others} entries={entries} />,
      );
      await user.click(screen.getByRole("menuitem", { name: /^Shrink if needed/ }));

      expect(mockSetSpacePolicy).toHaveBeenCalledWith(collection, 0, {
        type: "custom",
        actions: [{ deviceName: name, value: "resizeIfNeeded" }],
        release: name,
      });
    });

    it("releases it and keeps it, with no action of its own", async () => {
      const { user } = installerRender(
        <Items part={shrinkable} collection={collection} governed={others} entries={entries} />,
      );
      await user.click(screen.getByRole("menuitem", { name: /^Do not modify/ }));

      expect(mockSetSpacePolicy).toHaveBeenCalledWith(collection, 0, {
        type: "custom",
        actions: [],
        release: name,
      });
    });

    it("keeps the decisions of the other partitions", async () => {
      const decided = [{ name: other.name, delete: true }];
      const { user } = installerRender(
        <Items
          part={shrinkable}
          collection={collection}
          governed={others}
          entries={[...entries, ...decided]}
        />,
      );
      await user.click(screen.getByRole("menuitem", { name: /^Shrink if needed/ }));

      expect(mockSetSpacePolicy).toHaveBeenCalledWith(collection, 0, {
        type: "custom",
        actions: [
          { deviceName: other.name, value: "delete" },
          { deviceName: name, value: "resizeIfNeeded" },
        ],
        release: name,
      });
    });

    it("marks nothing as taken", () => {
      installerRender(
        <Items part={shrinkable} collection={collection} governed={others} entries={entries} />,
      );

      screen.getAllByRole("menuitem").forEach((item) => {
        expect(item).not.toHaveClass("pf-m-selected");
      });
    });
  });
});
