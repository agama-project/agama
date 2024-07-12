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
import { partition } from "~/utils";
import { Popup } from "~/components/core";

/**
 * Returns given text capitalized
 *
 * TODO: make it work with i18n
 *
 * @param {String} text - string to be capitalized
 * @return {String} capitalized text
 */
const label = (text) => `${text[0].toUpperCase()}${text.slice(1)}`;

/**
 * A component for building a Question actions, using the defaultAction
 * as the Popup.PrimaryAction
 *
 * NOTE: We use the Popup component for displaying a question, wrapping its actions inside a
 * Popup.Actions component, which must be an immediate child of Popup. That's why we use
 * React.Fragment (aka <>) here for wrapping the actions instead of directly using the Popup.Actions.
 *
 * @param {object} props - component props
 * @param {Array.<String>} props.actions - the actions to be shown
 * @param {String} [props.defaultAction] - the action to be shown as primary
 * @param {function} props.actionCallback - the function to be called when user clicks on action
 * @param {Object} [props.conditions={}] - an object holding conditions, like when an action is disabled
 */
export default function QuestionActions({ actions, defaultAction, actionCallback, conditions }) {
  let [[primaryAction], secondaryActions] = partition(actions, (a) => a === defaultAction);

  // Ensure there is always a primary action
  if (!primaryAction) [primaryAction, ...secondaryActions] = secondaryActions;

  return (
    <>
      <Popup.PrimaryAction
        key={primaryAction}
        onClick={() => actionCallback(primaryAction)}
        isDisabled={conditions?.disable?.[primaryAction]}
      >
        {label(primaryAction)}
      </Popup.PrimaryAction>
      {secondaryActions.map((action) => (
        <Popup.SecondaryAction
          key={action}
          onClick={() => actionCallback(action)}
          isDisabled={conditions?.disable?.[action]}
        >
          {label(action)}
        </Popup.SecondaryAction>
      ))}
    </>
  );
}
