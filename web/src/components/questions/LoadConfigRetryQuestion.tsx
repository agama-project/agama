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
import { Content, Stack } from "@patternfly/react-core";
import { NestedContent, Popup } from "~/components/core";
import { AnswerCallback, Question } from "~/api/question";
import QuestionActions from "~/components/questions/QuestionActions";
import { _ } from "~/i18n";

/**
 * Component for rendering generic questions
 *
 * @param question - the question to be answered
 * @param answerCallback - the callback to be triggered on answer
 */
export default function RetryLoadConfigQuestion({
  question,
  answerCallback,
}: {
  question: Question;
  answerCallback: AnswerCallback;
}): React.ReactNode {
  const actionCallback = (action: string) => {
    question.answer = { action };
    answerCallback(question);
  };

  const error = question.data?.error;

  return (
    <Popup isOpen title={_("Configuration unreachable or invalid")}>
      <Stack hasGutter>
        <Content isEditorial>{question.text}</Content>
        {error && (
          <NestedContent>
            <Content component="pre">{error}</Content>
          </NestedContent>
        )}
      </Stack>
      <Popup.Actions>
        <QuestionActions
          actions={question.actions}
          defaultAction={question.defaultAction}
          actionCallback={actionCallback}
        />
      </Popup.Actions>
    </Popup>
  );
}
