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

const onChangeFn = jest.fn();

const TestingSelector = ({ isMultiple = false, selectedIds = ["es_ES"], ...props }) => {
  const [selected, setSelected] = React.useState(selectedIds);

  onChangeFn.mockImplementation((selection) => setSelected(selection));

  return (
    <Selector
      isMultiple={isMultiple}
      options={[
        { id: "es_ES", nid: 1, label: "Spanish", country: "Spain" },
        { id: "en_GB", nid: 2, label: "English", country: "United Kingdom" }
      ]}
      renderOption={(option) => <div>{option.label} - {option.country}</div>}
      selectedIds={selected}
      onSelectionChange={onChangeFn}
      aria-label="Testing selector"
      { ...props }
    />
  );
};

const MultipleTestingSelector = (props) => <TestingSelector { ...props } isMultiple />;

describe("Selector", () => {
  it("renders a selector and its options", () => {
    plainRender(<TestingSelector />);
    const selector = screen.getByRole("grid", { name: "Testing selector" });
    within(selector).getByRole("row", { name: "Spanish - Spain" });
    within(selector).getByRole("row", { name: "English - United Kingdom" });
  });

  it("uses `id` as key for the option id if `optionIdKey` prop is not given", async () => {
    const { user } = plainRender(<TestingSelector />);
    const option = screen.getByRole("row", { name: "English - United Kingdom" });
    await user.click(option);
    expect(onChangeFn).toHaveBeenCalledWith(["en_GB"]);
  });

  it("uses given `optionIdKey` as key for the option id", async () => {
    const { user } = plainRender(<TestingSelector optionIdKey="nid" />);
    const option = screen.getByRole("row", { name: "English - United Kingdom" });
    await user.click(option);
    expect(onChangeFn).toHaveBeenCalledWith([2]);
  });

  it("sets data-auto-selected attribute to selected options for which `autoSelectionCheck` returns true", () => {
    plainRender(
      // Forcing a not selected option (en_GB) as auto selected for checking that it is not.
      <TestingSelector autoSelectionCheck={o => ["es_ES", "en_GB"].includes(o.id)} />
    );
    const spanishRow = screen.getByRole("row", { name: "Spanish - Spain auto selected" });
    const englishRow = screen.getByRole("row", { name: "English - United Kingdom" });
    const spanishOption = within(spanishRow).getByRole("radio");
    const englishOption = within(englishRow).getByRole("radio");
    expect(spanishRow).toHaveAttribute("data-auto-selected");
    expect(spanishOption).toHaveAttribute("data-auto-selected");
    expect(englishRow).not.toHaveAttribute("data-auto-selected");
    expect(englishOption).not.toHaveAttribute("data-auto-selected");
  });

  describe("when set as single selector", () => {
    it("renders a radio input for each option", () => {
      plainRender(<TestingSelector />);
      const selector = screen.getByRole("grid", { name: "Testing selector" });
      const options = within(selector).getAllByRole("row");
      options.forEach((option) => within(option).getByRole("radio"));
    });

    describe("and user clicks on a selected option", () => {
      it("keeps it as selected and does not trigger the #onSelectionChange callback", async () => {
        const { user } = plainRender(<TestingSelector selectedIds={["es_ES", "en_GB"]} />);
        const option = screen.getByRole("row", { name: "English - United Kingdom" });
        expect(option).toHaveAttribute("aria-selected");
        await user.click(option);
        expect(option).toHaveAttribute("aria-selected");
        expect(onChangeFn).not.toHaveBeenCalled();
      });
    });

    describe("and user clicks a not selected option", () => {
      it("sets it as selected and triggers the #onSelectionChange callback", async () => {
        const { user } = plainRender(<TestingSelector selectedIds={["es_ES"]} />);
        const initialSelection = screen.getByRole("row", { name: "Spanish - Spain" });
        const nextSelection = screen.getByRole("row", { name: "English - United Kingdom" });
        expect(initialSelection).toHaveAttribute("aria-selected");
        expect(nextSelection).not.toHaveAttribute("aria-selected");
        await user.click(nextSelection);
        expect(initialSelection).not.toHaveAttribute("aria-selected");
        expect(nextSelection).toHaveAttribute("aria-selected");
        expect(onChangeFn).toHaveBeenCalledWith(["en_GB"]);
      });
    });
  });

  describe("when set as multiple selector", () => {
    it("renders a checkbox input for each option", () => {
      plainRender(<MultipleTestingSelector />);
      const selector = screen.getByRole("grid", { name: "Testing selector" });
      const options = within(selector).getAllByRole("row");
      options.forEach((option) => within(option).getByRole("checkbox"));
    });

    describe("and user clicks on a selected option", () => {
      it("sets it as not selected and triggers the #onSelectionChange callback", async () => {
        const { user } = plainRender(<MultipleTestingSelector selectedIds={["es_ES", "en_GB"]} />);
        const option = screen.getByRole("row", { name: "English - United Kingdom" });
        expect(option).toHaveAttribute("aria-selected");
        await user.click(option);
        expect(option).not.toHaveAttribute("aria-selected");
        expect(onChangeFn).toHaveBeenCalledWith(expect.not.arrayContaining(["en_GB"]));
      });
    });

    describe("and user clicks on a not selected option", () => {
      it("sets it as selected and triggers the #onSelectionChange callback", async () => {
        const { user } = plainRender(<MultipleTestingSelector selectedIds={["es_ES"]} />);
        const option = screen.getByRole("row", { name: "English - United Kingdom" });
        expect(option).not.toHaveAttribute("aria-selected");
        await user.click(option);
        expect(option).toHaveAttribute("aria-selected");
        expect(onChangeFn).toHaveBeenCalledWith(expect.arrayContaining(["en_GB"]));
      });
    });
  });
});
