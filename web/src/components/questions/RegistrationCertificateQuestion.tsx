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
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import {
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Stack,
  StackItem,
} from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { AnswerCallback, Question } from "~/types/questions";
import QuestionActions from "~/components/questions/QuestionActions";
import { _ } from "~/i18n";

type QuestionDataProps = {
  label: string;
  value?: string;
};

function QuestionData({ label, value }: QuestionDataProps): React.ReactNode | null {
  if (!value) return null;

  return (
    <DescriptionListGroup>
      <DescriptionListTerm>{label}</DescriptionListTerm>
      <DescriptionListDescription>{value}</DescriptionListDescription>
    </DescriptionListGroup>
  );
}

/**
 * Component to ask for trusting a self signed certificate.
 *
 * @param question - the question to be answered
 * @param answerCallback - the callback to be triggered on answer
 */
export default function RegistrationCertificateQuestion({
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

  return (
    <Popup isOpen title={_("Registration certificate")}>
      <Stack hasGutter>
        <StackItem>
          <Content component="p" isEditorial>
            {question.text}
          </Content>
        </StackItem>
        <StackItem>
          <DescriptionList isHorizontal isCompact className={spacingStyles.mxLg}>
            <QuestionData label={_("URL")} value={question.data.url} />
            <QuestionData label={_("Issuer")} value={question.data.issuer_name} />
            <QuestionData label={_("Issue date")} value={question.data.issue_date} />
            <QuestionData label={_("Expiration date")} value={question.data.expiration_date} />
            <QuestionData label={_("SHA1 fingerprint")} value={question.data.sha1_fingerprint} />
            <QuestionData
              label={_("SHA256 fingerprint")}
              value={question.data.sha256_fingerprint}
            />
          </DescriptionList>
        </StackItem>
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
