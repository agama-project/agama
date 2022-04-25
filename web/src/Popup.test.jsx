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

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installerRender } from "./test-utils";

import Popup from "./Popup";

let isOpen;
const onConfirmFn = jest.fn();
const confirmText = "Let's go";
const onCancelFn = jest.fn();
const cancelText = "Close without saving";
const onUnsetFn = jest.fn();
const unsetText = "Ignore this setting";

const TestingPopup = (props) => (
  <Popup
    title="Testing Popup component"
    isOpen={isOpen}
    onConfirm={onConfirmFn}
    confirmText={confirmText}
    onCancel={onCancelFn}
    cancelText={cancelText}
    onUnset={onUnsetFn}
    unsetText={unsetText}
    { ...props }
  >
    <p>The Popup Content</p>
  </Popup>
);

describe("Popup", () => {
  describe("when it is not open", () => {
    beforeEach(() => {
      isOpen = false;
    });

    it("displays nothing", async () => {
      installerRender(<TestingPopup />);

      const dialog = await screen.queryByRole("dialog");
      expect(dialog).toBeNull();
    });
  });

  describe("when it is open", () => {
    beforeEach(() => {
      isOpen = true;
    });

    it("displays the popup content", async () => {
      installerRender(<TestingPopup />);

      const dialog = await screen.findByRole("dialog");

      within(dialog).getByText("The Popup Content");
    });

    it.each([
      { action: "confirm", actionText: confirmText },
      { action: "cancel", actionText: cancelText },
      { action: "unset", actionText: unsetText }
    ])("honors autoFocusOn={'$action'} when $action is enabled", async ({ action, actionText }) => {
      const actionDisabledProp = `${action}Disabled`;
      const props = {
        autoFocusOn: action,
        [actionDisabledProp]: false
      };

      installerRender(<TestingPopup { ...props } />);

      const dialog = await screen.findByRole("dialog");
      const actionButton = within(dialog).queryByRole("button", { name: actionText });
      expect(actionButton).toHaveFocus();
    });

    it.each([
      { action: "confirm", actionText: confirmText },
      { action: "cancel", actionText: cancelText },
      { action: "unset", actionText: unsetText }
    ])("does not honor autoFocusOn={'$action'} when $action is disabled", async ({ action, actionText }) => {
      const actionDisabledProp = `${action}Disabled`;
      const props = {
        autoFocusOn: action,
        [actionDisabledProp]: true
      };

      installerRender(<TestingPopup { ...props } />);

      const dialog = await screen.findByRole("dialog");
      const actionButton = within(dialog).queryByRole("button", { name: actionText });
      expect(actionButton).not.toHaveFocus();
    });

    it.each([
      { action: "Cancel", actionText: cancelText },
      { action: "Unset", actionText: unsetText }
    ])("includes the '$action' action when its callback is defined", async ({ action, actionText }) => {
      installerRender(<TestingPopup />);

      const dialog = await screen.findByRole("dialog");
      const actionButton = within(dialog).queryByRole("button", { name: actionText });
      expect(actionButton).not.toBeNull();
    });

    it.each([
      { action: "Cancel", actionText: cancelText },
      { action: "Unset", actionText: unsetText }
    ])("does not include the '$action' action when its callback is not defined", async ({ action, actionText }) => {
      const props = {
        [`on${action}`]: undefined
      };

      installerRender(<TestingPopup { ...props } />);

      const dialog = await screen.findByRole("dialog");
      const actionButton = within(dialog).queryByRole("button", { name: actionText });
      expect(actionButton).toBeNull();
    });

    it.each([
      { action: "confirm", actionText: confirmText, actionFn: onConfirmFn },
      { action: "cancel", actionText: cancelText, actionFn: onCancelFn },
      { action: "unset", actionText: unsetText, actionFn: onUnsetFn }
    ])("triggers the '$action' callback when action is enabled and the user clicks on it", async ({ action, actionFn, actionText }) => {
      const props = {
        [`${action}Disabled`]: false
      };

      installerRender(<TestingPopup { ...props } />);

      const dialog = await screen.findByRole("dialog");
      const actionButton = within(dialog).queryByRole("button", { name: actionText });
      userEvent.click(actionButton);

      expect(actionFn).toHaveBeenCalled();
    });

    it.each([
      { action: "confirm", actionText: confirmText, actionFn: onConfirmFn },
      { action: "cancel", actionText: cancelText, actionFn: onCancelFn },
      { action: "unset", actionText: unsetText, actionFn: onUnsetFn }
    ])("does not trigger the '$action' callback when action is disabled", async ({ action, actionFn, actionText }) => {
      const props = {
        [`${action}Disabled`]: true
      };

      installerRender(<TestingPopup { ...props } />);

      const dialog = await screen.findByRole("dialog");
      const actionButton = within(dialog).queryByRole("button", { name: actionText });
      userEvent.click(actionButton);

      expect(actionFn).not.toHaveBeenCalled();
    });
  });
});
