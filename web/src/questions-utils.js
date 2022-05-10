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
import Popup from "./Popup";
import { partition } from "./utils";

/**
 * Returns given text capitalized
 *
 * @param {String} text - string to be capitalized
 * @returns {String} capitalized text
 */
const label = text => `${text[0].toUpperCase()}${text.slice(1)}`;

/**
 * Returns a the options of given question as collection of Popup.Actions, using the defaultOption
 * as the Popup.PrimaryAction
 *
 * TODO: Make it a component?
 *
 * @param {Object} question - the question object
 * @param {function} actionCallback - the function to be called when user clicks the action
 * @returns {Popup.Actions} a set of Popup.Actions based on the question options
 */
const buildQuestionActions = (question, actionCallback, conditions = {}) => {
  let [[defaultOption], options] = partition(question.options, o => o === question.defaultOption);

  // Ensure there is always a default option
  if (!defaultOption) [defaultOption, ...options] = options;

  return (
    <Popup.Actions>
      <Popup.PrimaryAction
        key={defaultOption}
        onClick={() => actionCallback(defaultOption)}
        isDisabled={conditions?.disable?.[defaultOption]}
      >
        {label(defaultOption)}
      </Popup.PrimaryAction>
      {
        options.map(option =>
          <Popup.SecondaryAction
            key={option}
            onClick={() => actionCallback(option)}
            isDisabled={conditions?.disable?.[option]}
          >
            {label(option)}
          </Popup.SecondaryAction>
        )
      }
    </Popup.Actions>
  );
};

export {
  buildQuestionActions
};
