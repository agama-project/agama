/*
 * Copyright (c) [2024] SUSE LLC
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
import { plainRender } from "~/test-utils";
import { Selector } from "~/components/core";

const TestingSelector = (props) => {
  return (
    <Selector {...props}>
      <Selector.Option id="es_ES">Spanish - Spain</Selector.Option>
      <Selector.Option id="en_GB">English - United Kingdom</Selector.Option>
    </Selector>
  );
};

describe("Selector", () => {
  it("renders a selector and its options", () => {
    plainRender(<TestingSelector aria-label="Testing selector" />);
    const selector = screen.getByRole("grid", { name: "Testing selector" });
    within(selector).getByRole("row", { name: "Spanish - Spain" });
    within(selector).getByRole("row", { name: "English - United Kingdom" });
  });

  describe("when set as single selector", () => {
    it("renders a radio input for each option", () => {
      plainRender(<TestingSelector aria-label="Testing selector" />);
      const selector = screen.getByRole("grid", { name: "Testing selector" });
      const options = within(selector).getAllByRole("row");
      options.forEach((option) => within(option).getByRole("radio"));
    });

    it("triggers the #onSelectionChange callback when user clicks a not selected option", async () => {
      const onChange = jest.fn();
      const { user } = plainRender(
        <TestingSelector selectedIds={["es_ES"]} onSelectionChange={onChange} aria-label="Testing selector" />
      );
      const selectedOption = screen.getByRole("row", { name: "English - United Kingdom" });
      await user.click(selectedOption);
      expect(onChange).toHaveBeenCalledWith(["en_GB"]);
    });

    it("does not trigger the #onSelectionChange callback when user clicks an already selected option", async () => {
      const onChange = jest.fn();
      const { user } = plainRender(
        <TestingSelector selectedIds={["es_ES"]} onSelectionChange={onChange} aria-label="Testing selector" />
      );
      const selectedOption = screen.getByRole("row", { name: "Spanish - Spain" });
      await user.click(selectedOption);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("when set as multiple selector", () => {
    it("renders a checkbox input for each option", () => {
      plainRender(<TestingSelector isMultiple aria-label="Testing selector" />);
      const selector = screen.getByRole("grid", { name: "Testing selector" });
      const options = within(selector).getAllByRole("row");
      options.forEach((option) => within(option).getByRole("checkbox"));
    });

    describe("and user clicks an option", () => {
      it("triggers the #onSelectionChange callback", async () => {
        const onChange = jest.fn();
        const { user } = plainRender(
          <TestingSelector isMultiple onSelectionChange={onChange} aria-label="Testing selector" />
        );
        const selectedOption = screen.getByRole("row", { name: "English - United Kingdom" });
        await user.click(selectedOption);
        expect(onChange).toHaveBeenCalled();
      });

      it("marks the option as selected if it was not selected", async () => {
        const onChange = jest.fn();
        const { user } = plainRender(
          <TestingSelector
            isMultiple
            selectedIds={["es_ES"]}
            onSelectionChange={onChange}
            aria-label="Testing selector"
          />
        );
        const selectedOption = screen.getByRole("row", { name: "English - United Kingdom" });
        await user.click(selectedOption);
        expect(onChange).toHaveBeenCalledWith(["es_ES", "en_GB"]);
      });

      it("marks the option as not selected if it was selected", async () => {
        const onChange = jest.fn();
        const { user } = plainRender(
          <TestingSelector
            isMultiple
            selectedIds={["es_ES", "en_GB"]}
            onSelectionChange={onChange}
            aria-label="Testing selector"
          />
        );
        const selectedOption = screen.getByRole("row", { name: "English - United Kingdom" });
        await user.click(selectedOption);
        expect(onChange).toHaveBeenCalledWith(["es_ES"]);
      });
    });
  });
});
