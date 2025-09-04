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

/**
 * A component for building a Question actions, using the defaultAction
 * as the Popup.PrimaryAction
 *
 * NOTE: We use the Popup component for displaying a question, wrapping its actions inside a
 * Popup.Actions component, which must be an immediate child of Popup. That's why we use
 * React.Fragment (aka <>) here for wrapping the actions instead of directly using the Popup.Actions.
 *
 * @param {object} props - component props
 * @param props.actions - the actions (untranslated, passed to actionCallback)
 * @param props.actionLabels - the actions to show (translated)
 * @param props.defaultAction - the action to show as primary (untranslated)
 * @param props.actionCallback - the function to call when the user clicks on the action
 * @param props.conditions={} - an object holding conditions, like when an action is disabled
 */
export default function QuestionActions({
  actions,
  actionLabels,
  defaultAction,
  actionCallback,
  conditions = {},
}: {
  actions: string[];
  actionLabels: string[];
  defaultAction?: string;
  actionCallback: (action: string) => void;
  conditions?: { disable?: { [key: string]: boolean } };
}): React.ReactNode {
  let [[primaryAction], secondaryActions] = fork(actions, (a: string) => a === defaultAction);

  // Ensure there is always a primary action
  if (!primaryAction) [primaryAction, ...secondaryActions] = secondaryActions;

  const actionsToLabels = {};
  for (let i = 0; i < actions.length; i++) {
    const action: string = actions[i];
    const label: string = actionLabels[i];
    actionsToLabels[action] = label;
  }

  return (
    <>
      <Popup.PrimaryAction
        key={primaryAction}
        onClick={() => actionCallback(primaryAction)}
        isDisabled={conditions?.disable?.[primaryAction]}
      >
        {actionsToLabels[primaryAction]}
      </Popup.PrimaryAction>
      {secondaryActions.map((action) => (
        <Popup.SecondaryAction
          key={action}
          onClick={() => actionCallback(action)}
          isDisabled={conditions?.disable?.[action]}
        >
          {actionsToLabels[action]}
        </Popup.SecondaryAction>
      ))}
    </>
  );
}
