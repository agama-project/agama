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

import React, { useState } from "react";
import {
  CodeBlock,
  Content,
  ExpandableSection,
  Flex,
  Form,
  FormGroup,
  Stack,
  TextInput,
} from "@patternfly/react-core";
import { NestedContent, Popup } from "~/components/core";
import Text from "~/components/core/Text";
import QuestionActions from "~/components/questions/QuestionActions";
import { _ } from "~/i18n";
import type { AnswerCallback, Question } from "~/model/question";

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
  const [url, setUrl] = useState(question.data?.originalValue || "");

  const actionCallback = (action: string) => {
    question.answer = { action, value: url };
    answerCallback(question);
  };

  const error = question.data?.error;

  return (
    <Popup isOpen title={_("Cannot apply configuration")}>
      <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
        <Content isEditorial>{question.text}</Content>
        <Form isWidthLimited={false}>
          {/* TRANSLATORS: field label */}
          <FormGroup label={_("Location")} fieldId="location">
            <TextInput
              id="location"
              size={1000}
              value={url}
              onChange={(_event, value) => setUrl(value)}
            />
          </FormGroup>
        </Form>
        <Content>
          <Text isBold>
            {_("Verify that the location is correct and the configuration is valid.")}
          </Text>
        </Content>
        {error && (
          <ExpandableSection
            toggleTextExpanded={_("Hide technical details")}
            toggleTextCollapsed={_("Show technical details (English only)")}
          >
            <NestedContent>
              <CodeBlock>
                <Stack hasGutter>{error}</Stack>
              </CodeBlock>
            </NestedContent>
          </ExpandableSection>
        )}
      </Flex>
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
