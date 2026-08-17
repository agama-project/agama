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

import React, { createContext, useContext, useId } from "react";
import { Form } from "@patternfly/react-core";
import { fork } from "radashi";
import { Popup } from "~/components/core/Popup";

import type { DistributedOmit } from "type-fest";
import type { FormProps } from "@patternfly/react-core";
import type { PopupProps } from "~/components/core/Popup";
import type { Action, AnswerCallback, Question } from "~/model/question";

/**
 * Which of the given actions is presented as the primary one.
 *
 * It is the default action when it is part of the list, the first action
 * otherwise. Questions rendering a form must submit this very action, so that
 * pressing Enter and clicking the primary button do the same thing.
 *
 * @param actions - the actions offered by the question
 * @param defaultAction - the id of the action the question suggests
 */
function primaryAction(actions: Action[], defaultAction?: string): Action {
  const [[preferred], rest] = fork(actions, (a: Action) => a.id === defaultAction);

  return preferred || rest[0];
}

type QuestionDialogProps = DistributedOmit<PopupProps, "isOpen" | "actions" | "children"> & {
  /** The question to be answered */
  question: Question;
  /** The callback to be triggered on answer */
  answerCallback: AnswerCallback;
  /** The value sent with the answer, for questions asking the user for one */
  value?: string;
  /** Ids of the actions the user cannot pick yet */
  disabledActions?: string[];
  /** Whether the body renders a {@link QuestionForm} */
  hasForm?: boolean;
  /** The dialog body */
  children: React.ReactNode;
};

type QuestionFormWiring = {
  formId: string;
  handleSubmit: (event: React.FormEvent) => void;
};

const QuestionFormContext = createContext<QuestionFormWiring | null>(null);

/**
 * The form a question renders in the body of its {@link QuestionDialog}, wired
 * to answer the question with the primary action.
 *
 * Available only in dialogs rendered with `hasForm`, which is what makes the
 * primary action submit this form instead of answering on click.
 *
 * @example
 *   <QuestionDialog question={question} answerCallback={answerCallback} hasForm>
 *     <QuestionDialog.Form>
 *       <FormGroup label="Password" fieldId="password">
 *         <PasswordInput id="password" value={password} onChange={setPassword} />
 *       </FormGroup>
 *     </QuestionDialog.Form>
 *   </QuestionDialog>
 */
function QuestionForm(props: Omit<FormProps, "id" | "onSubmit">): React.ReactNode {
  const wiring = useContext(QuestionFormContext);

  if (!wiring) {
    throw new Error("QuestionDialog.Form needs a QuestionDialog rendered with hasForm");
  }

  return <Form {...props} id={wiring.formId} onSubmit={wiring.handleSubmit} />;
}

/**
 * The dialog presenting an installer question, built on top of
 * {@link ~/components/core/Popup Popup}.
 *
 * Its children are the dialog body; the footer holds one button per action the
 * question offers, the primary one being the action the question suggests.
 * Picking any of them answers the question and hands it over to
 * `answerCallback`.
 *
 * Questions must be answered, so the dialog offers no way out other than its
 * actions.
 *
 * Questions asking the user for something send it in the `value` prop, and
 * usually collect it in a {@link QuestionForm}, which lets the user answer by
 * pressing Enter too.
 *
 * @example <caption>A question the user just acknowledges</caption>
 *   <QuestionDialog
 *     question={question}
 *     answerCallback={answerCallback}
 *     title="Package installation failed"
 *   >
 *     <Content>{question.text}</Content>
 *   </QuestionDialog>
 *
 * @example <caption>A question asking for a password</caption>
 *   <QuestionDialog
 *     question={question}
 *     answerCallback={answerCallback}
 *     title="Password required"
 *     value={password}
 *     disabledActions={password === "" ? ["decrypt"] : []}
 *     hasForm
 *   >
 *     <QuestionDialog.Form>
 *       <FormGroup label="Password" fieldId="password">
 *         <PasswordInput id="password" value={password} onChange={setPassword} />
 *       </FormGroup>
 *     </QuestionDialog.Form>
 *   </QuestionDialog>
 */
export default function QuestionDialog({
  question,
  answerCallback,
  value,
  disabledActions = [],
  hasForm = false,
  children,
  ...popupProps
}: QuestionDialogProps): React.ReactNode {
  const formId = useId();

  const answer = (action: string) => {
    question.answer = value === undefined ? { action } : { action, value };
    answerCallback(question);
  };

  const primary = primaryAction(question.actions, question.defaultAction);
  const secondaryActions = question.actions.filter((action) => action !== primary);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!disabledActions.includes(primary.id)) answer(primary.id);
  };

  const actions = (
    <>
      <Popup.PrimaryAction
        isDisabled={disabledActions.includes(primary.id)}
        {...(hasForm ? { type: "submit", form: formId } : { onClick: () => answer(primary.id) })}
      >
        {primary.label}
      </Popup.PrimaryAction>
      {secondaryActions.map((action) => (
        <Popup.SecondaryAction
          key={action.id}
          onClick={() => answer(action.id)}
          isDisabled={disabledActions.includes(action.id)}
        >
          {action.label}
        </Popup.SecondaryAction>
      ))}
    </>
  );

  const dialog = (
    <Popup {...popupProps} isOpen actions={actions}>
      {children}
    </Popup>
  );

  if (!hasForm) return dialog;

  return (
    <QuestionFormContext.Provider value={{ formId, handleSubmit }}>
      {dialog}
    </QuestionFormContext.Provider>
  );
}

QuestionDialog.Form = QuestionForm;
