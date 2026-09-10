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
import { Tab, Tabs, TabTitleText } from "@patternfly/react-core";
import { plainRender } from "~/test-utils";
import { useTablistKeyboard } from "~/hooks/use-tablist-keyboard";

/** A strip of three, as the sheet builds one. */
function Strip() {
  const [tab, setTab] = React.useState("one");
  const { containerProps, tabProps } = useTablistKeyboard(["one", "two", "three"], tab, setTab);

  return (
    <div {...containerProps}>
      <Tabs activeKey={tab} onSelect={(_event, key) => setTab(String(key))} aria-label="Views">
        <Tab eventKey="one" {...tabProps("one")} title={<TabTitleText>One</TabTitleText>}>
          first
        </Tab>
        <Tab eventKey="two" {...tabProps("two")} title={<TabTitleText>Two</TabTitleText>}>
          second
        </Tab>
        <Tab eventKey="three" {...tabProps("three")} title={<TabTitleText>Three</TabTitleText>}>
          third
        </Tab>
      </Tabs>
    </div>
  );
}

const tab = (name: string) => screen.getByRole("tab", { name });

describe("useTablistKeyboard", () => {
  it("makes the whole strip one stop, on whichever tab is open", () => {
    plainRender(<Strip />);

    expect(tab("One")).toHaveAttribute("tabindex", "0");
    expect(tab("Two")).toHaveAttribute("tabindex", "-1");
    expect(tab("Three")).toHaveAttribute("tabindex", "-1");
  });

  it("moves along the strip with the arrows, showing what it arrives at", async () => {
    const { user } = plainRender(<Strip />);
    await user.tab();
    expect(tab("One")).toHaveFocus();

    await user.keyboard("{ArrowRight}");

    expect(tab("Two")).toHaveFocus();
    expect(tab("Two")).toHaveAttribute("aria-selected", "true");
    screen.getByText("second");
  });

  it("comes round rather than stopping at either end", async () => {
    const { user } = plainRender(<Strip />);
    await user.tab();
    await user.keyboard("{ArrowLeft}");

    expect(tab("Three")).toHaveFocus();
  });

  it("jumps to either end", async () => {
    const { user } = plainRender(<Strip />);
    await user.tab();
    await user.keyboard("{End}");
    expect(tab("Three")).toHaveFocus();

    await user.keyboard("{Home}");
    expect(tab("One")).toHaveFocus();
  });

  it("leaves the strip in one press, since it is one stop", async () => {
    const { user } = plainRender(<Strip />);
    await user.tab();
    await user.tab();

    expect(tab("One")).not.toHaveFocus();
    expect(tab("Two")).not.toHaveFocus();
    expect(tab("Three")).not.toHaveFocus();
  });
});
