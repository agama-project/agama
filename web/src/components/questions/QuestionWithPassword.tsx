/*
 * Copyright (c) [2024-2025] SUSE LLC
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

import React, { useState } from "react";
import { Content, Form, FormGroup, Stack } from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { InstallerOptions, PasswordInput, Popup } from "~/components/core";
import QuestionActions from "~/components/questions/QuestionActions";
import { _ } from "~/i18n";
import type { AnswerCallback, Question } from "~/api/question";

/**
 * Component for rendering questions asking for password
 *
 * @param question - the question to be answered
 * @param answerCallback - the callback to be triggered on answer
 */
export default function QuestionWithPassword({
  question,
  answerCallback,
}: {
  question: Question;
  answerCallback: AnswerCallback;
}): React.ReactNode {
  const [password, setPassword] = useState(question.answer?.value || "");

  const actionCallback = (action: string) => {
    const answer = { action, value: password };
    question.answer = answer;
    answerCallback(question);
  };

  return (
    <Popup
      isOpen
      title={_("Password Required")}
      titleIconVariant={() => <Icon name="lock" />}
      titleAddon={<InstallerOptions variant="keyboard" />}
    >
      <Stack hasGutter>
        <Content>{question.text}</Content>
        <Form>
          {/* TRANSLATORS: field label */}
          <FormGroup label={_("Password")} fieldId="password">
            <PasswordInput
              autoFocus
              id="password"
              value={password}
              onChange={(_, value) => setPassword(value)}
            />
          </FormGroup>
        </Form>
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
