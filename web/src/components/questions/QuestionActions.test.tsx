/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { installerRender } from "~/test-utils";
import { Question } from "~/types/questions";
import QuestionActions from "~/components/questions/QuestionActions";

let defaultOption = "sure";

let question: Question = {
  id: 1,
  text: "Should we use a component for rendering actions?",
  options: ["no", "maybe", "sure"],
  defaultOption,
};

const actionCallback = jest.fn();

const renderQuestionActions = () =>
  installerRender(
    <QuestionActions
      actions={question.options}
      defaultAction={question.defaultOption}
      actionCallback={actionCallback}
      conditions={{ disable: { no: true } }}
    />,
  );

describe("QuestionActions", () => {
  describe("when question has a default option", () => {
    it("renders the default option as primary action", async () => {
      renderQuestionActions();

      const button = await screen.findByRole("button", { name: "Sure" });
      expect(button.classList.contains("pf-m-primary")).toBe(true);
    });

    it("renders non default options as secondary actions", async () => {
      renderQuestionActions();

      let button = await screen.findByRole("button", { name: "Maybe" });
      expect(button.classList.contains("pf-m-secondary")).toBe(true);

      button = await screen.findByRole("button", { name: "No" });
      expect(button.classList.contains("pf-m-secondary")).toBe(true);
    });
  });

  describe("when question does not have a default option", () => {
    beforeEach(() => {
      // Using destructuring for partially clone the object.
      // See "Gotcha if there's no let" at https://javascript.info/destructuring-assignment#the-rest-pattern
      ({ defaultOption, ...question } = question);
    });

    it("renders the first option  as primary action", async () => {
      renderQuestionActions();

      const button = await screen.findByRole("button", { name: "No" });
      expect(button.classList.contains("pf-m-primary")).toBe(true);
    });

    it("renders the other options as secondary actions", async () => {
      renderQuestionActions();

      let button = await screen.findByRole("button", { name: "Maybe" });
      expect(button.classList.contains("pf-m-secondary")).toBe(true);

      button = await screen.findByRole("button", { name: "Sure" });
      expect(button.classList.contains("pf-m-secondary")).toBe(true);
    });
  });

  it("renders actions enabled or disabled according to given conditions", async () => {
    renderQuestionActions();

    let button = await screen.findByRole("button", { name: "No" });
    expect(button).toHaveAttribute("disabled");

    button = await screen.findByRole("button", { name: "Maybe" });
    expect(button).not.toHaveAttribute("disabled");
  });

  it("calls the actionCallback when user clicks on action", async () => {
    const { user } = renderQuestionActions();

    const button = await screen.findByRole("button", { name: "Sure" });
    await user.click(button);

    expect(actionCallback).toHaveBeenCalled();
  });
});
