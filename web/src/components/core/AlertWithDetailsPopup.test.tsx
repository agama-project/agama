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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import Popup from "~/components/core/Popup";
import AlertWithDetailsPopup, {
  AlertWithDetailsPopupProps,
} from "~/components/core/AlertWithDetailsPopup";

const Example = (props: Partial<AlertWithDetailsPopupProps>) => (
  <AlertWithDetailsPopup
    variant="custom"
    title="Applying the configuration will take 8 actions."
    actionLabel="View changes"
    popupTitle="Planned storage changes"
    {...props}
  >
    Delete partition /dev/sda1
  </AlertWithDetailsPopup>
);

const action = () => screen.getByRole("button", { name: "View changes" });
const popup = () => screen.getByRole("dialog", { name: "Planned storage changes" });
/* By its text, since the cross in the popup header is named "Close" too. */
const closeAction = () => within(popup()).getByText("Close");

describe("AlertWithDetailsPopup", () => {
  it("says its sentence and its action in one line", () => {
    installerRender(<Example />);

    const line = screen.getByText(/Applying the configuration will take 8 actions./);
    expect(line).toContainElement(action());
  });

  it("keeps the details out of the page until they are asked for", () => {
    installerRender(<Example />);

    expect(screen.queryByText("Delete partition /dev/sda1")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers the details through a button, since they have no address", () => {
    installerRender(<Example />);

    expect(action().tagName).toBe("BUTTON");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("names the action in full where it is given a longer name", () => {
    installerRender(
      <Example actionLabel="Show more" actionAriaLabel="Show more about the storage layout" />,
    );

    screen.getByRole("button", { name: "Show more about the storage layout" });
  });

  it("opens the details in a popup named by its title", async () => {
    const { user } = installerRender(<Example popupDescription="Not applied yet" />);
    await user.click(action());

    within(popup()).getByText("Delete partition /dev/sda1");
    within(popup()).getByText("Not applied yet");
  });

  it("closes the popup and puts the reader back on the action", async () => {
    const { user } = installerRender(<Example />);
    await user.click(action());
    await user.click(closeAction());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(action()).toHaveFocus();
  });

  it("closes the popup on Escape", async () => {
    const { user } = installerRender(<Example />);
    await user.click(action());
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers the popup's own actions besides closing it", async () => {
    const reset = jest.fn();
    const { user } = installerRender(
      <Example
        popupActions={<Popup.SecondaryAction onClick={reset}>Reset</Popup.SecondaryAction>}
      />,
    );
    await user.click(action());
    await user.click(within(popup()).getByRole("button", { name: "Reset" }));

    expect(reset).toHaveBeenCalled();
    closeAction();
  });
});
