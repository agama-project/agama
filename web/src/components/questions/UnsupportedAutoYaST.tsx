/*
 * Copyright (c) [2025] SUSE LLC
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
import { Text } from "@patternfly/react-core";
import { AnswerCallback, Question } from "~/types/questions";
import { Popup } from "~/components/core";
import { _ } from "~/i18n";
import QuestionActions from "~/components/questions/QuestionActions";
import { sprintf } from "sprintf-js";

const UnsupportedElementsText = ({ data }: { data: { [key: string]: string } }) => {
  if (data.unsupported.length === 0) {
    return undefined;
  }

  const elements = data.unsupported.split(",");

  return (
    <Text>
      {sprintf(
        _("These elements are not supported and there are no plans to support them: %s."),
        elements.join(", "),
      )}
    </Text>
  );
};

const PlannedElementsText = ({ data }: { data: { [key: string]: string } }) => {
  if (data.planned.length === 0) {
    return undefined;
  }

  const elements = data.planned.split(",");

  return (
    <Text>
      {sprintf(
        _("These elements are not supported but there are plans to support them: %s."),
        elements.join(", "),
      )}
    </Text>
  );
};

export default function UnsupportedAutoYaST({
  question,
  answerCallback,
}: {
  question: Question;
  answerCallback: AnswerCallback;
}) {
  const actionCallback = (option: string) => {
    question.answer = option;
    answerCallback(question);
  };

  return (
    <Popup isOpen aria-label={_("Unsupported AutoYaST elements")}>
      <Text>{question.text}</Text>
      <UnsupportedElementsText data={question.data} />
      <PlannedElementsText data={question.data} />
      <Popup.Actions>
        <QuestionActions
          actions={question.options}
          defaultAction={question.defaultOption}
          actionCallback={actionCallback}
        />
      </Popup.Actions>
    </Popup>
  );
}
