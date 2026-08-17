/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { Popup } from "~/components/core";
import { fork } from "radashi";
import type { Action } from "~/model/question";

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
export function primaryAction(actions: Action[], defaultAction?: string): Action {
  const [[preferred], rest] = fork(actions, (a: Action) => a.id === defaultAction);

  return preferred || rest[0];
}

/**
 * A component for building a Question actions, using the defaultAction
 * as the Popup.PrimaryAction
 *
 * Meant to be given to the `actions` prop of a Popup, which is what puts the
 * buttons in the dialog footer.
 *
 * @param {object} props - component props
 * @param props.actions - the actions show
 * @param props.defaultAction - the action to show as primary
 * @param props.actionCallback - the function to call when the user clicks on the action
 * @param props.conditions={} - an object holding conditions, like when an action is disabled
 * @param props.formId - the id of the form the primary action submits, for
 *   questions rendering one; the form is then responsible for answering
 */
export default function QuestionActions({
  actions,
  defaultAction,
  actionCallback,
  conditions = {},
  formId,
}: {
  actions: Action[];
  defaultAction?: string;
  actionCallback: (action: string) => void;
  conditions?: { disable?: { [key: string]: boolean } };
  formId?: string;
}): React.ReactNode {
  const primary = primaryAction(actions, defaultAction);
  const secondaryActions = actions.filter((action) => action !== primary);

  return (
    <>
      <Popup.PrimaryAction
        key={primary.id}
        isDisabled={conditions?.disable?.[primary.id]}
        {...(formId
          ? { type: "submit", form: formId }
          : { onClick: () => actionCallback(primary.id) })}
      >
        {primary.label}
      </Popup.PrimaryAction>
      {secondaryActions.map((action) => (
        <Popup.SecondaryAction
          key={action.id}
          onClick={() => actionCallback(action.id)}
          isDisabled={conditions?.disable?.[action.id]}
        >
          {action.label}
        </Popup.SecondaryAction>
      ))}
    </>
  );
}
