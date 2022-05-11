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
import { screen } from "@testing-library/react";
import { installerRender } from "./test-utils";
import QuestionActions from "./QuestionActions";

const question = {
  id: 1,
  text: "Should we use a component instead?",
  options: ["handsdown", "maybe", "no"],
  defaultOption: "maybe"
};

const actionCallback = jest.fn();

const renderQuestionActions = () => (
  installerRender(
    <QuestionActions
      actions={question.options}
      defaultAction={question.defaultOption}
      actionCallback={actionCallback}
      conditions={ { disable: { no: true } } }
    />
  )
);

describe("QuestionActions", () => {
  it("renders the default option as primary action", async () => {
    renderQuestionActions();

    const button = await screen.findByRole("button", { name: "Maybe" });
    expect(button.classList.contains("pf-m-primary")).toBe(true);
  });

  it("renders non default options as secondary actions", async () => {
    renderQuestionActions();

    let button = await screen.findByRole("button", { name: "Handsdown" });
    expect(button.classList.contains("pf-m-secondary")).toBe(true);

    button = await screen.findByRole("button", { name: "No" });
    expect(button.classList.contains("pf-m-secondary")).toBe(true);
  });

  it("renders actions enabled or disabled according to given conditions", async () => {
    renderQuestionActions();

    let button = await screen.findByRole("button", { name: "No" });
    expect(button).toHaveAttribute('disabled');

    button = await screen.findByRole("button", { name: "Maybe" });
    expect(button).not.toHaveAttribute('disabled');
  });

  it("calls the actionCallback when useers clicks on action", async () => {
    const { user } = renderQuestionActions();

    const button = await screen.findByRole("button", { name: "Handsdown" });
    await user.click(button);

    expect(actionCallback).toHaveBeenCalled();
  });
});
