/*
 * Copyright (c) [2022-2025] SUSE LLC
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

import React, { useState } from "react";

import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";

import { Popup } from "~/components/core";
import { PopupProps } from "./Popup";
import { _ } from "~/i18n";

let isOpen: boolean;
let isLoading: boolean;
const confirmFn = jest.fn();
const cancelFn = jest.fn();

const TestingPopup = (props: PopupProps) => {
  const [isMounted, setIsMounted] = useState(true);
  const loadingText = _("Loading text");

  if (!isMounted) return null;

  return (
    <Popup
      title="Testing Popup Title"
      isOpen={isOpen}
      isLoading={isLoading}
      loadingText={loadingText}
      {...props}
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
  const loadingText = _("Loading text");

  describe("when it is not open", () => {
    beforeEach(() => {
      isOpen = false;
    });

    it("renders nothing", async () => {
      installerRender(<TestingPopup>Testing</TestingPopup>);

      const dialog = screen.queryByRole("dialog");
      expect(dialog).toBeNull();
    });
  });

  describe("when it is open", () => {
    beforeEach(() => {
      isOpen = true;
    });

    it("renders given title and titleAddon inside PF/ModalHeader", async () => {
      installerRender(
        <TestingPopup title="Awesome Popup" titleAddon={<button>With action at title</button>}>
          Testing
        </TestingPopup>,
      );

      const dialog = await screen.findByRole("dialog");
      const header = within(dialog).getByRole("banner");
      within(header).getByRole("heading", { name: "Awesome Popup" });
      within(header).getByRole("button", { name: "With action at title" });
    });

    it("does not render header when none, title nor titleAddon, are giving", async () => {
      installerRender(
        <TestingPopup title={undefined} titleAddon={undefined}>
          Testing
        </TestingPopup>,
      );

      await screen.findByRole("dialog");
      expect(screen.queryByRole("banner")).toBeNull();
    });

    describe("and not loading", () => {
      beforeEach(() => {
        isLoading = false;
      });

      it("renders the popup content inside a PF/Modal", async () => {
        installerRender(<TestingPopup>Testing</TestingPopup>);

        const dialog = await screen.findByRole("dialog");
        expect(dialog.classList.contains("pf-v6-c-modal-box")).toBe(true);

        within(dialog).getByText("The Popup Content");
      });

      it("does not display a progress message", async () => {
        installerRender(<TestingPopup>Testing</TestingPopup>);

        const dialog = await screen.findByRole("dialog");

        expect(within(dialog).queryByText(loadingText)).toBeNull();
      });

      it("renders the popup actions inside a PF/Modal footer", async () => {
        installerRender(<TestingPopup>Testing</TestingPopup>);

        const dialog = await screen.findByRole("dialog");
        // NOTE: Sadly, PF Modal/ModalFooter does not have a footer or navigation role.
        // So, using https://developer.mozilla.org/es/docs/Web/API/Document/querySelector
        // for getting the footer. See https://github.com/testing-library/react-testing-library/issues/417 too.
        const footer = dialog.querySelector("footer");

        within(footer).getByText("Confirm");
        within(footer).getByText("Cancel");
      });
    });

    describe("and loading", () => {
      beforeEach(() => {
        isLoading = true;
      });

      it("displays progress message instead of the content", async () => {
        installerRender(<TestingPopup>Testing</TestingPopup>);

        const dialog = await screen.findByRole("dialog");

        expect(within(dialog).queryByText("The Popup Content")).toBeNull();
        within(dialog).getByText(loadingText);
      });
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

describe("Popup.DangerousAction", () => {
  it("renders a 'danger' button with given children as content", async () => {
    installerRender(<Popup.DangerousAction>Format everything</Popup.DangerousAction>);

    const button = screen.queryByRole("button", { name: "Format everything" });
    expect(button.classList.contains("pf-m-danger")).toBe(true);
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
