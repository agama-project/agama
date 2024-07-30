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
import { installerRender, plainRender } from "~/test-utils";
import { Questions } from "~/components/questions";
import { QuestionType } from "~/types/questions";
import * as GenericQuestionComponent from "~/components/questions/GenericQuestion";

let mockQuestions;
const mockMutation = jest.fn();

jest.mock("~/components/questions/LuksActivationQuestion", () => () => (
  <div>A LUKS activation question mock</div>
));
jest.mock("~/components/questions/QuestionWithPassword", () => () => (
  <div>A question with password mock</div>
));

jest.mock("~/queries/questions", () => ({
  ...jest.requireActual("~/queries/software"),
  useQuestions: () => mockQuestions,
  useQuestionsChanges: () => jest.fn(),
  useQuestionsConfig: () => ({ mutate: mockMutation }),
}));

const genericQuestion = {
  id: 1,
  type: QuestionType.generic,
  text: "Do you write unit tests?",
  options: ["always", "sometimes", "never"],
  defaultOption: "sometimes",
};
const passwordQuestion = { id: 1, type: QuestionType.withPassword };
const luksActivationQuestion = { id: 1, class: "storage.luks_activation" };

describe("Questions", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("when there are no pending questions", () => {
    beforeEach(() => {
      mockQuestions = [];
    });

    it("renders nothing", () => {
      const { container } = plainRender(<Questions />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when a question is answered", () => {
    beforeEach(() => {
      mockQuestions = [genericQuestion];
    });

    it("triggers the useQuestionMutationk", async () => {
      const { user } = plainRender(<Questions />);
      const button = screen.getByRole("button", { name: "Always" });
      await user.click(button);
      expect(mockMutation).toHaveBeenCalledWith({ ...genericQuestion, answer: "always" });
    });
  });

  describe("when there is a generic question pending", () => {
    beforeEach(() => {
      mockQuestions = [genericQuestion];
      // Not using jest.mock at the top like for the other question components
      // because the original implementation was needed for testing that
      // mutation is triggered when proceed.
      jest
        .spyOn(GenericQuestionComponent, "default")
        .mockReturnValue(<div>A generic question mock</div>);
    });

    it("renders a GenericQuestion component", () => {
      plainRender(<Questions />);
      screen.getByText("A generic question mock");
    });
  });

  describe("when there is a generic question pending", () => {
    beforeEach(() => {
      mockQuestions = [passwordQuestion];
    });

    it("renders a QuestionWithPassword component", () => {
      plainRender(<Questions />);
      screen.getByText("A question with password mock");
    });
  });

  describe("when there is a LUKS activation question pending", () => {
    beforeEach(() => {
      mockQuestions = [luksActivationQuestion];
    });

    it("renders a LuksActivationQuestion component", () => {
      installerRender(<Questions />);
      screen.getByText("A LUKS activation question mock");
    });
  });
});
