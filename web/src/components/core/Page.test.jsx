/*
 * Copyright (c) [2023] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { installerRender, plainRender, mockNavigateFn } from "~/test-utils";
import { Page, PageOptions } from "~/components/core";

describe("Page", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation();
  });

  afterAll(() => {
    console.error.mockRestore();
  });

  it("renders given title", () => {
    installerRender(<Page title="The Title" />, { withL10n: true });
    screen.getByRole("heading", { name: "The Title" });
  });

  it("renders 'Agama' as title if no title is given", () => {
    installerRender(<Page />, { withL10n: true });
    screen.getByRole("heading", { name: "Agama" });
  });

  it("renders an icon if valid icon name is given", () => {
    installerRender(<Page icon="settings" />, { withL10n: true });
    const heading = screen.getByRole("heading", { level: 1 });
    const icon = heading.querySelector("svg");
    expect(icon).toHaveAttribute("data-icon-name", "settings");
  });

  it("does not render an icon if icon name not given", () => {
    installerRender(<Page title="Settings" />, { withL10n: true });
    const heading = screen.getByRole("heading", { level: 1 });
    const icon = heading.querySelector("svg");
    expect(icon).toBeNull();
    // Check that <Icon /> component was not mounted with 'undefined'
    expect(console.error).not.toHaveBeenCalled();
  });

  it("does not render an icon if not valid icon name is given", () => {
    installerRender(<Page title="Settings" />, { withL10n: true });
    const heading = screen.getByRole("heading", { level: 1 });
    const icon = heading.querySelector("svg");
    expect(icon).toBeNull();
  });

  it("renders given content", () => {
    installerRender(
      <Page>
        <section>Page content</section>
      </Page>,
      { withL10n: true }
    );

    screen.getByText("Page content");
  });

  it("renders found page options in the header", async () => {
    const { user } = installerRender(
      <Page>
        <div>A page with options</div>
        <PageOptions>
          <PageOptions.Option>
            <button>Switch to advanced mode</button>
          </PageOptions.Option>
        </PageOptions>
      </Page>,
      { withL10n: true }
    );

    const [header,] = screen.getAllByRole("banner");
    const optionsButton = within(header).getByRole("button", { name: "Show page options" });
    await user.click(optionsButton);
    screen.getByRole("menuitem", { name: "Switch to advanced mode" });
  });

  it("renders given actions", () => {
    installerRender(
      <Page>
        <Page.Actions>
          <Page.Action>Save</Page.Action>
          <Page.Action>Discard</Page.Action>
        </Page.Actions>
      </Page>,
      { withL10n: true }
    );

    screen.getByRole("button", { name: "Save" });
    screen.getByRole("button", { name: "Discard" });
  });

  it("renders the default 'Back' action if no actions are given", () => {
    installerRender(<Page />, { withL10n: true });
    screen.getByRole("button", { name: "Back" });
  });

  it("renders the Agama sidebar", async () => {
    const { user } = installerRender(<Page />, { withL10n: true });

    const openSidebarButton = screen.getByRole("button", { name: "Show global options" });

    await user.click(openSidebarButton);
    screen.getByRole("complementary", { name: /options/i });
  });
});

describe("Page.Actions", () => {
  it("renders its children", () => {
    plainRender(
      <Page.Actions>
        <button>Plain action</button>
      </Page.Actions>
    );

    screen.getByRole("button", { name: "Plain action" });
  });
});

describe("Page.Action", () => {
  it("renders a button with given content", () => {
    plainRender(<Page.Action>Save</Page.Action>);
    screen.getByRole("button", { name: "Save" });
  });

  it("renders an 'lg' button when size prop is not given", () => {
    plainRender(<Page.Action>Cancel</Page.Action>);
    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button.classList.contains("pf-m-display-lg")).toBe(true);
  });

  describe("when user clicks on it", () => {
    it("triggers given onClick handler, if valid", async () => {
      const onClick = jest.fn();
      const { user } = plainRender(<Page.Action onClick={onClick}>Cancel</Page.Action>);
      const button = screen.getByRole("button", { name: "Cancel" });
      await user.click(button);
      expect(onClick).toHaveBeenCalled();
    });

    it("navigates to the path given through 'navigateTo' prop", async () => {
      const { user } = plainRender(<Page.Action navigateTo="/somewhere">Cancel</Page.Action>);
      const button = screen.getByRole("button", { name: "Cancel" });
      await user.click(button);
      expect(mockNavigateFn).toHaveBeenCalledWith("/somewhere");
    });

    it("triggers form submission if it's a submit action and has an associated form", async () => {
      // NOTE: using preventDefault here to avoid a jsdom error
      // Error: Not implemented: HTMLFormElement.prototype.requestSubmit
      const onSubmit = jest.fn((e) => { e.preventDefault() });

      const { user } = plainRender(
        <>
          <form onSubmit={onSubmit} id="fake-form" />
          <Page.Action type="submit" form="fake-form">
            Send
          </Page.Action>
        </>
      );
      const button = screen.getByRole("button", { name: "Send" });
      await user.click(button);
      expect(onSubmit).toHaveBeenCalled();
    });

    it("triggers form submission even when onClick and navigateTo are given", async () => {
      const onClick = jest.fn();
      // NOTE: using preventDefault here to avoid a jsdom error
      // Error: Not implemented: HTMLFormElement.prototype.requestSubmit
      const onSubmit = jest.fn((e) => { e.preventDefault() });

      const { user } = plainRender(
        <>
          <form onSubmit={onSubmit} id="fake-form" />
          <Page.Action
            type="submit"
            form="fake-form"
            onClick={onClick}
            navigateTo="/somewhere"
          >
            Send
          </Page.Action>
        </>
      );
      const button = screen.getByRole("button", { name: "Send" });
      await user.click(button);
      expect(onSubmit).toHaveBeenCalled();
      expect(onClick).toHaveBeenCalled();
      expect(mockNavigateFn).toHaveBeenCalledWith("/somewhere");
    });
  });
});

describe("Page.BackAction", () => {
  beforeAll(() => {
    jest.spyOn(history, "back").mockImplementation();
  });

  afterAll(() => {
    history.back.mockRestore();
  });

  it("renders a 'Back' button with large size and secondary style", () => {
    plainRender(<Page.BackAction />);
    const button = screen.getByRole("button", { name: "Back" });
    expect(button.classList.contains("pf-m-display-lg")).toBe(true);
    expect(button.classList.contains("pf-m-secondary")).toBe(true);
  });

  it("triggers history.back() when user clicks on it", async () => {
    const { user } = plainRender(<Page.BackAction />);
    const button = screen.getByRole("button", { name: "Back" });
    await user.click(button);
    expect(history.back).toHaveBeenCalled();
  });
});
