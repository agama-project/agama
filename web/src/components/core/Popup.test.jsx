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

import React, { useState } from "react";

import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";

import { Popup } from "~/components/core";

let isOpen;
const confirmFn = jest.fn();
const cancelFn = jest.fn();

const TestingPopup = (props) => {
  const [isMounted, setIsMounted] = useState(true);

  if (!isMounted) return null;

  return (
    <Popup
      title="Testing Popup component"
      isOpen={isOpen}
      { ...props }
    >
      <p>The Popup Content</p>
      <button onClick={() => setIsMounted(false)}>Unmount Popup</button>
      <Popup.Actions>
        <Popup.Confirm onClick={confirmFn} isDisabled />
        <Popup.Cancel onClick={cancelFn} />
      </Popup.Actions>
    </Popup>
  );
};

describe("Popup", () => {
  describe("when it is not open", () => {
    beforeEach(() => {
      isOpen = false;
    });

    it("renders nothing", async () => {
      installerRender(<TestingPopup />);

      const dialog = screen.queryByRole("dialog");
      expect(dialog).toBeNull();
    });
  });

  describe("when it is open", () => {
    beforeEach(() => {
      isOpen = true;
    });

    it("renders the popup content inside a PF4/Modal", async () => {
      installerRender(<TestingPopup />);

      const dialog = await screen.findByRole("dialog");
      expect(dialog.classList.contains("pf-v5-c-modal-box")).toBe(true);

      within(dialog).getByText("The Popup Content");
    });

    it("renders the popup actions inside a PF4/Modal footer", async () => {
      installerRender(<TestingPopup />);

      const dialog = await screen.findByRole("dialog");
      // NOTE: Sadly, PF4 Modal/ModalFooter does not have a footer or navigation role.
      // So, using https://developer.mozilla.org/es/docs/Web/API/Document/querySelector
      // for getting the footer. See https://github.com/testing-library/react-testing-library/issues/417 too.
      const footer = dialog.querySelector("footer");

      within(footer).getByText("Confirm");
      within(footer).getByText("Cancel");
    });

    it("removes aria-hidden attributes from body children (workaround for patternfly/patternfly-react#9096)", async () => {
      const { user } = installerRender(
        <>
          <article>Popup Sibling</article>
          <TestingPopup />
        </>,
        // Force React Testing Library to render the component directly in the
        // body for emulating the default behavior of the PF4/Modal when no
        // appendTo prop is given.
        // https://testing-library.com/docs/react-testing-library/api/#container
        { container: document.body }
      );

      await screen.findByRole("dialog");
      const sibling = screen.getByText("Popup Sibling");
      const unmountButton = await screen.getByRole("button", { name: "Unmount Popup" });
      expect(sibling).toHaveAttribute("aria-hidden");
      await user.click(unmountButton);
      expect(sibling).not.toHaveAttribute("aria-hidden");
    });
  });
});

describe("Popup.PrimaryAction", () => {
  it("renders a 'primary' button with given children as content", async () => {
    installerRender(<Popup.PrimaryAction>Do something</Popup.PrimaryAction>);

    const button = screen.queryByRole("button", { name: "Do something" });
    expect(button.classList.contains("pf-m-primary")).toBe(true);
  });
});

describe("Popup.SecondaryAction", () => {
  it("renders a 'secondary' button with given children as content", async () => {
    installerRender(<Popup.SecondaryAction>Do something</Popup.SecondaryAction>);

    const button = screen.queryByRole("button", { name: "Do something" });
    expect(button.classList.contains("pf-m-secondary")).toBe(true);
  });
});

describe("Popup.AncillaryAction", () => {
  it("renders a 'link' button with given children as content", async () => {
    installerRender(<Popup.AncillaryAction>Do not use</Popup.AncillaryAction>);

    const button = screen.queryByRole("button", { name: "Do not use" });
    expect(button.classList.contains("pf-m-link")).toBe(true);
  });
});

describe("Popup.Confirm", () => {
  describe("when holding no children", () => {
    it("renders a 'primary' button using 'Confirm' text as content", async () => {
      installerRender(<Popup.Confirm />);

      const button = screen.queryByRole("button", { name: "Confirm" });
      expect(button).not.toBeNull();
      expect(button.classList.contains("pf-m-primary")).toBe(true);
    });
  });

  describe("when holding children", () => {
    it("renders a 'primary' button with children as content", async () => {
      installerRender(<Popup.Confirm>Let's go</Popup.Confirm>);

      const button = screen.queryByRole("button", { name: "Let's go" });
      expect(button).not.toBeNull();
      expect(button.classList.contains("pf-m-primary")).toBe(true);
    });
  });
});

describe("Popup.Cancel", () => {
  describe("when holding no children", () => {
    it("renders a 'secondary' button using 'Cancel' text as content", async () => {
      installerRender(<Popup.Cancel />);

      const button = screen.queryByRole("button", { name: "Cancel" });
      expect(button).not.toBeNull();
      expect(button.classList.contains("pf-m-secondary")).toBe(true);
    });
  });

  describe("when holding children", () => {
    it("renders a 'secondary' button with children as content", async () => {
      installerRender(<Popup.Cancel>Discard</Popup.Cancel>);

      const button = screen.queryByRole("button", { name: "Discard" });
      expect(button).not.toBeNull();
      expect(button.classList.contains("pf-m-secondary")).toBe(true);
    });
  });
});
