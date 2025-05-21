/*
 * Copyright (c) [2023-2025] SUSE LLC
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
  Button,
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
import { Solution } from "~/types/software";
import { useConflicts, useConflictsChanges } from "~/queries/software";
import { solveConflict } from "~/api/software";
import { sprintf } from "sprintf-js";
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
  details?: Solution["details"];
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
  const [chosenSolution, setChosenSolution] = useState<Solution["id"] | undefined>();

  const onSubmit = async (e) => {
    e.preventDefault();
    solveConflict({ solutionId: chosenSolution, conflictId: conflict.id });
  };

  return (
    <Form id="conflict-resolution" onSubmit={onSubmit}>
      <FormGroup isStack>
        {conflict.solutions.map((solution: Solution) => (
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
        <Page.Submit form="conflict-resolution">{_("Apply solution")}</Page.Submit>
      </ActionGroup>
    </Form>
  );
};

/**
 * Conflicts component
 */
function SoftwareConflicts(): React.ReactNode {
  useConflictsChanges();
  const conflicts = useConflicts();
  const [conflictId, setConflictId] = useState(0);
  const onNext = async () => {
    setConflictId(conflictId + 1);
  };
  const onBack = async () => {
    setConflictId(conflictId - 1);
  };

  const NoConflicts = (): React.ReactNode => (
    <Page.Content>
      <b>{_("All conflicts solved.")}</b>
    </Page.Content>
  );

  const ConflictsToolbar = (): React.ReactNode => (
    <Toolbar hasNoPadding>
      <ToolbarContent>
        <ToolbarItem alignSelf="center">
          <Title headingLevel="h3">
            {sprintf(_("Conflict %d of %d"), conflictId + 1, conflicts.length)}
          </Title>
        </ToolbarItem>
        <ToolbarGroup align={{ default: "alignEnd" }} alignItems="center">
          <ToolbarItem>
            <Button variant="plain" size="sm" onClick={onBack}>
              <Flex component="span" alignItems={{ default: "alignItemsCenter" }}>
                <Icon name="chevron_left" /> {_("Skip to Previous")}
              </Flex>
            </Button>
          </ToolbarItem>
          <ToolbarItem variant="separator" />
          <ToolbarItem>
            <Button variant="plain" size="sm" onClick={onNext}>
              <Flex component="span" alignItems={{ default: "alignItemsCenter" }}>
                {_("Skip to Next")} <Icon name="chevron_right" />
              </Flex>
            </Button>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );

  const ConflictsUI = (): React.ReactNode => {
    // if the latest conflict is solved, then show the last one
    const conflict = conflictId < conflicts.length ? conflicts[conflictId] : conflicts.at(-1);

    return (
      <Page.Content>
        <ConflictsToolbar />
        <Divider />
        <Title headingLevel="h4">{conflict.description}</Title>
        <ConflictsForm conflict={conflict} />
      </Page.Content>
    );
  };

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Conflict resolution")}</Content>
        <SubtleContent>
          {_(
            "Selected software contain conflicts. The conflicts can potentially depends on each other and order of solution is not important.",
          )}
        </SubtleContent>
      </Page.Header>

      {conflicts.length > 0 ? <ConflictsUI /> : <NoConflicts />}

      <Page.Actions>
        <Page.Cancel variant="secondary">{_("Close")}</Page.Cancel>
      </Page.Actions>
    </Page>
  );
}

export default SoftwareConflicts;
