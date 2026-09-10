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
import { Button } from "@patternfly/react-core";
import { plainRender } from "~/test-utils";
import Sheet, { SheetPlacement } from "~/components/core/Sheet";

/**
 * The sheet as a reader meets it: a page with a control that opens it, so
 * closing it has somewhere to put the focus back.
 */
function Example({ placement = "overlay" }: { placement?: SheetPlacement }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Sheet
      isOpen={isOpen}
      placement={placement}
      onClose={() => setIsOpen(false)}
      title="Result"
      description="What the installer will do"
      page={<Button onClick={() => setIsOpen(true)}>View all 5 needed actions</Button>}
    >
      <Button>Reformat</Button>
    </Sheet>
  );
}

const opener = () => screen.getByRole("button", { name: "View all 5 needed actions" });
const sheet = () => screen.getByRole("region", { name: "Result" });

describe("Sheet", () => {
  it("shows nothing of the sheet until it is opened", () => {
    plainRender(<Example />);

    expect(screen.queryByRole("region", { name: "Result" })).not.toBeInTheDocument();
    opener();
  });

  it("names itself as a region, and says what it is about", async () => {
    const { user } = plainRender(<Example />);
    await user.click(opener());

    sheet();
    screen.getByRole("heading", { level: 2, name: "Result" });
    screen.getByText("What the installer will do");
  });

  it("moves the reader into the sheet when it opens", async () => {
    const { user } = plainRender(<Example />);
    await user.click(opener());

    expect(sheet()).toHaveFocus();
  });

  it("puts the reader back on what opened it when it closes", async () => {
    const { user } = plainRender(<Example />);
    await user.click(opener());
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(opener()).toHaveFocus();
  });

  it("closes on Escape from anywhere inside it", async () => {
    const { user } = plainRender(<Example />);
    await user.click(opener());
    await user.click(screen.getByRole("button", { name: "Reformat" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("region", { name: "Result" })).not.toBeInTheDocument();
  });

  describe("when it comes over the page", () => {
    it("puts the page it covers out of reach", async () => {
      const { user } = plainRender(<Example placement="overlay" />);
      await user.click(opener());

      expect(opener().closest("[inert]")).not.toBeNull();
    });
  });

  describe("when it stands beside the page", () => {
    it("leaves the page usable", async () => {
      const { user } = plainRender(<Example placement="share" />);
      await user.click(opener());

      expect(opener().closest("[inert]")).toBeNull();
    });
  });
});
