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
import { FormGroup, TextInput } from "@patternfly/react-core";
import { installerRender } from "~/test-utils";
import { FieldType } from "~/model/question";
import type { Question } from "~/model/question";
import QuestionDialog from "~/components/questions/QuestionDialog";

let question: Question;
const questionMock: Question = {
  id: 1,
  class: "none",
  text: "Do you want to proceed?",
  field: { type: FieldType.None },
  actions: [
    { id: "cancel", label: "Cancel" },
    { id: "proceed", label: "Proceed" },
  ],
  defaultAction: "proceed",
};

const answerFn = jest.fn();

describe("QuestionDialog", () => {
  beforeEach(() => {
    question = { ...questionMock };
    answerFn.mockClear();
  });

  it("renders a dialog named by the given title, holding the given content", () => {
    installerRender(
      <QuestionDialog question={question} answerCallback={answerFn} title="A question">
        <p>{question.text}</p>
      </QuestionDialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "A question" });
    within(dialog).getByText("Do you want to proceed?");
  });

  it("renders the action the question suggests as primary and the rest as secondary", () => {
    installerRender(
      <QuestionDialog question={question} answerCallback={answerFn} title="A question">
        <p>{question.text}</p>
      </QuestionDialog>,
    );

    const proceed = screen.getByRole("button", { name: "Proceed" });
    expect(proceed.classList.contains("pf-m-primary")).toBe(true);

    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel.classList.contains("pf-m-secondary")).toBe(true);
  });

  describe("when the question suggests no action", () => {
    beforeEach(() => {
      question = { ...questionMock, defaultAction: undefined };
    });

    it("renders the first action as primary", () => {
      installerRender(
        <QuestionDialog question={question} answerCallback={answerFn} title="A question">
          <p>{question.text}</p>
        </QuestionDialog>,
      );

      const cancel = screen.getByRole("button", { name: "Cancel" });
      expect(cancel.classList.contains("pf-m-primary")).toBe(true);

      const proceed = screen.getByRole("button", { name: "Proceed" });
      expect(proceed.classList.contains("pf-m-secondary")).toBe(true);
    });

    it("answers with the first action when the form is submitted", async () => {
      const { user } = installerRender(
        <QuestionDialog question={question} answerCallback={answerFn} title="A question" hasForm>
          <QuestionDialog.Form>
            <FormGroup label="Location" fieldId="location">
              <TextInput id="location" value="typed" onChange={() => undefined} />
            </FormGroup>
          </QuestionDialog.Form>
        </QuestionDialog>,
      );

      await user.type(screen.getByRole("textbox", { name: "Location" }), "{enter}");

      expect(question.answer).toEqual({ action: "cancel" });
    });
  });

  it("answers the question with the picked action", async () => {
    const { user } = installerRender(
      <QuestionDialog question={question} answerCallback={answerFn} title="A question">
        <p>{question.text}</p>
      </QuestionDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(question.answer).toEqual({ action: "cancel" });
    expect(answerFn).toHaveBeenCalledWith(question);
  });

  it("sends the given value along with the answer", async () => {
    const { user } = installerRender(
      <QuestionDialog
        question={question}
        answerCallback={answerFn}
        title="A question"
        value="something"
      >
        <p>{question.text}</p>
      </QuestionDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Proceed" }));

    expect(question.answer).toEqual({ action: "proceed", value: "something" });
  });

  it("renders disabled the actions the user cannot pick yet", () => {
    installerRender(
      <QuestionDialog
        question={question}
        answerCallback={answerFn}
        title="A question"
        disabledActions={["proceed"]}
      >
        <p>{question.text}</p>
      </QuestionDialog>,
    );

    expect(screen.getByRole("button", { name: "Proceed" })).toHaveAttribute("disabled");
    expect(screen.getByRole("button", { name: "Cancel" })).not.toHaveAttribute("disabled");
  });

  describe("when the body renders a form", () => {
    const renderQuestionWithForm = (disabledActions: string[] = []) =>
      installerRender(
        <QuestionDialog
          question={question}
          answerCallback={answerFn}
          title="A question"
          value="typed"
          disabledActions={disabledActions}
          hasForm
        >
          <QuestionDialog.Form>
            <FormGroup label="Location" fieldId="location">
              <TextInput id="location" value="typed" onChange={() => undefined} />
            </FormGroup>
          </QuestionDialog.Form>
        </QuestionDialog>,
      );

    it("answers the question with the primary action when the form is submitted", async () => {
      const { user } = renderQuestionWithForm();

      await user.type(screen.getByRole("textbox", { name: "Location" }), "{enter}");

      expect(question.answer).toEqual({ action: "proceed", value: "typed" });
      expect(answerFn).toHaveBeenCalledWith(question);
    });

    it("does not answer the question when the primary action is disabled", async () => {
      const { user } = renderQuestionWithForm(["proceed"]);

      await user.type(screen.getByRole("textbox", { name: "Location" }), "{enter}");

      expect(question.answer).toBeUndefined();
      expect(answerFn).not.toHaveBeenCalled();
    });
  });
});
