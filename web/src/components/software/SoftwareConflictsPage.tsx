/*
 * Copyright (c) [2025-2026] SUSE LLC
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
  ActionGroup,
  Alert,
  Button,
  ButtonProps,
  Content,
  Divider,
  Flex,
  Form,
  FormGroup,
  List,
  ListItem,
  Radio,
  RadioProps,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { Page, SubtleContent } from "~/components/core";
import { ConflictSolutionOption } from "~/types/software";
import { useConflicts, useConflictsChanges, useConflictsMutation } from "~/queries/software";
import { isNullish } from "radashi";
import { sprintf } from "sprintf-js";
import { SOFTWARE } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Renders a list of conflict details as a bullet list.
 * Used to display all actions associated with a conflict solution.
 *
 * @param props - Component props.
 * @param props.items - An array of strings representing the detail items to display.
 */
const DetailsList = ({ items }: { items: string[] }) => (
  <List>
    {items.map((d, i) => (
      <ListItem key={i}>
        <SubtleContent>{d}</SubtleContent>
      </ListItem>
    ))}
  </List>
);

type ConflictSolutionRadioProps = {
  /** Newline-separated string of solution actions */
  details?: ConflictSolutionOption["details"];
  /** Max number of visible detail lines before enabling toggle behavior */
  maxVisibleDetails?: number;
} & Omit<RadioProps, "ref">;

/**
 * A custom wrapper around PatternFly's Radio component for presenting a
 * conflict solution option. Optionally displays additional details or actions
 * with an expandable/collapsible list.
 *
 * Behavior:
 *   - If no details are provided, a plain radio button is rendered.
 *   - If a small number of details exist, they are shown directly.
 *   - If there are more than `maxVisibleDetails` (default 3), the list is
 *     collapsible.
 */
const ConflictSolutionRadio = ({
  details: rawDetails,
  maxVisibleDetails = 3,
  ...props
}: ConflictSolutionRadioProps) => {
  const [expanded, setExpanded] = useState(false);
  const details = rawDetails ? rawDetails?.split("\n") : [];

  if (details.length === 0) return <Radio {...props} />;
  if (details.length <= maxVisibleDetails)
    return <Radio {...props} body={<DetailsList items={details} />} />;

  const visibleDetails = expanded ? details : details.slice(0, maxVisibleDetails);
  const toggleText = expanded ? _("Show less actions") : _("Show more actions");
  const toggleIcon = expanded ? "unfold_less" : "unfold_more";
  const toggleVisibility = () => setExpanded(!expanded);

  return (
    <Radio
      body={
        <Content>
          <DetailsList items={visibleDetails} />
          <Button onClick={toggleVisibility} variant="plain" size="sm">
            <Flex alignItems={{ default: "alignItemsCenter" }}>
              <Icon name={toggleIcon} />
              {toggleText}
            </Flex>
          </Button>
        </Content>
      }
      {...props}
    />
  );
};

/**
 * Internal component responsible of rendering the form to allow users choose
 * and eventually apply a solution for given conflict
 */
const ConflictsForm = ({ conflict }): React.ReactNode => {
  const { mutate: solve } = useConflictsMutation();
  const [error, setError] = useState<string | null>(null);
  const [chosenSolution, setChosenSolution] = useState<ConflictSolutionOption["id"] | undefined>();

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!isNullish(chosenSolution)) {
      setError(null);
      solve({ conflictId: conflict.id, solutionId: chosenSolution });
    } else {
      setError(_("Select a solution to continue"));
    }
  };

  return (
    <Form id="conflict-resolution" onSubmit={onSubmit}>
      {error && <Alert variant="warning" isInline title={error} />}
      <Title headingLevel="h3">{conflict.description}</Title>
      <FormGroup isStack>
        {conflict.solutions.map((solution: ConflictSolutionOption) => (
          <ConflictSolutionRadio
            key={solution.id}
            id={`conflict-${conflict.id}-solution-${solution.id}`}
            name={`conflict-${conflict.id}-solution`}
            label={<Content isEditorial>{solution.description}</Content>}
            onChange={() => setChosenSolution(solution.id)}
            isChecked={solution.id === chosenSolution}
            details={solution.details}
          />
        ))}
      </FormGroup>
      <ActionGroup>
        <Page.Submit form="conflict-resolution">{_("Apply selected solution")}</Page.Submit>
      </ActionGroup>
    </Form>
  );
};

type ConflictsToolbarProps = {
  current: number;
  total: number;
  onNext: ButtonProps["onClick"];
  onBack: ButtonProps["onClick"];
};
const ConflictsToolbar = ({
  current,
  total,
  onNext,
  onBack,
}: ConflictsToolbarProps): React.ReactNode => (
  <Toolbar hasNoPadding>
    <ToolbarContent>
      <ToolbarItem isOverflowContainer alignSelf="center">
        <SubtleContent>
          {_(
            "Multiple conflicts found. You can address them in any order, and resolving one may resolve others.",
          )}
        </SubtleContent>
      </ToolbarItem>
      <ToolbarGroup align={{ default: "alignEnd" }} alignSelf="center" alignItems="center">
        <ToolbarItem>
          <Button variant="plain" size="sm" onClick={onBack} isDisabled={current === 1}>
            <Flex component="span" alignItems={{ default: "alignItemsCenter" }}>
              <Icon name="chevron_left" /> {_("Skip to previous")}
            </Flex>
          </Button>
        </ToolbarItem>
        <ToolbarItem variant="separator" />

        {
          // TRANSLATORS: This is a short status message like "1 of 3". It
          // indicates the position of the current item out of a total. The
          // first %d will be replaced with the current item number, the
          // second %d with the total number of items.
          sprintf(_("%d of %d"), current, total)
        }
        <ToolbarItem variant="separator" />
        <ToolbarItem>
          <Button variant="plain" size="sm" onClick={onNext} isDisabled={current === total}>
            <Flex component="span" alignItems={{ default: "alignItemsCenter" }}>
              {_("Skip to next")} <Icon name="chevron_right" />
            </Flex>
          </Button>
        </ToolbarItem>
      </ToolbarGroup>
    </ToolbarContent>
  </Toolbar>
);

/**
 * Displays content when there are no conflicts to resolve.
 * Typically shown when user lands on this page with no actionable items.
 */
const NoConflictsContent = () => (
  <>
    <Title headingLevel="h3">{_("No conflicts to address")}</Title>
    <Content isEditorial>
      {_(
        "All conflicts have been resolved, or none were detected. You can safely continue with your setup.",
      )}
    </Content>
  </>
);

/**
 * Main content component to display and navigate between multiple conflicts.
 *
 * Renders a toolbar (if more than one conflict), and the conflict resolution form.
 *
 * It uses a `key` prop for forcing an state reset when navigating back and
 * forward.
 *
 * See https://react.dev/learn/preserving-and-resetting-state#option-2-resetting-state-with-a-key
 */
const ConflictsContent = ({ conflicts }) => {
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const totalConflicts = conflicts.length;
  const lastConflictIndex = totalConflicts - 1;

  const onNext = async () => {
    currentConflictIndex < lastConflictIndex && setCurrentConflictIndex(currentConflictIndex + 1);
  };
  const onBack = async () => {
    currentConflictIndex > 0 && setCurrentConflictIndex(currentConflictIndex - 1);
  };

  const currentConflict = conflicts[currentConflictIndex];

  return (
    <>
      {conflicts.length > 1 && (
        <>
          <ConflictsToolbar
            current={currentConflictIndex + 1}
            total={totalConflicts}
            onNext={onNext}
            onBack={onBack}
          />
          <Divider />
        </>
      )}
      <ConflictsForm conflict={currentConflict} key={currentConflict.id} />
    </>
  );
};

/**
 * Top-level page for handling software conflicts resolution.
 *
 * Displays either a resolution form or a message when no conflicts are present.
 */
export default function SoftwareConflictsPage() {
  useConflictsChanges();
  const conflicts = useConflicts();

  return (
    <Page
      breadcrumbs={[
        { label: _("Software"), path: SOFTWARE.root },
        { label: _("Software conflicts resolution") },
      ]}
      progress={{ scope: "software" }}
    >
      <Page.Content>
        {conflicts.length > 0 ? <ConflictsContent conflicts={conflicts} /> : <NoConflictsContent />}
      </Page.Content>

      <Page.Actions>
        <Page.Cancel variant="secondary">{_("Close")}</Page.Cancel>
      </Page.Actions>
    </Page>
  );
}
