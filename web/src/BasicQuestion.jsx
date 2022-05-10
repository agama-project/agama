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
import { Text } from "@patternfly/react-core";
import Popup from "./Popup";
import { partition } from "./utils";

export default function BasicQuestion({ question, answerCallback }) {
  const answer = (option) => {
    question.answer = option;
    answerCallback(question);
  };

  const label = option => `${option[0].toUpperCase()}${option.slice[1]}`;

  const renderOptions = () => {
    let [[defaultOption], options] = partition(question.options, o => o === question.defaultOption);

    // Ensure there is a default option always
    if (!defaultOption) [defaultOption, ...options] = options

    return(
    <Popup.Actions>
      <Popup.PrimaryAction onclick={() => answer(defaultOption)}>{label(defaultOption)}</Popup.PrimaryAction>
      {options.map(option =>
          <Popup.SecondaryAction key={option} onclick={() => answer(option)}>{label(option)}</Popup.SecondaryAction>
        )}
    </Popup.Actions>

    )
  }

  return (
    <Popup isOpen aria-label="A question from DBus">
      <Text>
        { question.text }
      </Text>
      { renderOptions() }
    </Popup>
  );
}
