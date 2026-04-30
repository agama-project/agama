/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import xbytes from "xbytes";
import { fork, isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import {
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  ExpandableSection,
  Grid,
  GridItem,
  List,
  ListItem,
} from "@patternfly/react-core";
import Interpolate from "~/components/core/Interpolate";
import IssuesAlert from "~/components/core/IssuesAlert";
import Link from "~/components/core/Link";
import NestedContent from "~/components/core/NestedContent";
import Page from "~/components/core/Page";
import SubtleContent from "~/components/core/SubtleContent";
import Text from "~/components/core/Text";
import AutoSelectedLabel from "~/components/software/AutoSelectedLabel";
import PatternSelectionUnavailable from "~/components/software/PatternSelectionUnavailable";
import { useIssues } from "~/hooks/model/issue";
import { useProposal } from "~/hooks/model/proposal/software";
import { useAvailablePatterns } from "~/hooks/model/system/software";
import { isPatternSelected } from "~/utils/software";
import { SOFTWARE as PATHS } from "~/routes/paths";
import { _, n_ } from "~/i18n";

import type { Pattern } from "~/model/system/software";
import type { PatternsSelection } from "~/model/proposal/software";
import { SelectedBy } from "~/model/proposal/software";

/**
 * Empty state for a software section where nothing has been selected yet.
 */
const NothingSelected = ({
  to,
  body,
  buttonText,
}: {
  to: string;
  body: string;
  buttonText: string;
}) => (
  // TRANSLATORS: empty state title for a software section with nothing selected
  <EmptyState headingLevel="h4" titleText={_("None selected")} variant="sm">
    <EmptyStateBody>{body}</EmptyStateBody>
    <EmptyStateFooter>
      <EmptyStateActions>
        <Link to={to} isPrimary>
          {buttonText}
        </Link>
      </EmptyStateActions>
    </EmptyStateFooter>
  </EmptyState>
);

/**
 * Informational empty state shown when patterns are not available.
 */
const NoAvailable = ({ title, body }: { title: string; body: string }) => (
  <EmptyState headingLevel="h4" titleText={title} variant="sm">
    <EmptyStateBody>{body}</EmptyStateBody>
  </EmptyState>
);

/**
 * A single pattern entry with its name, optional auto-selected label, and an
 * expandable description.
 *
 * Uses a controlled ExpandableSection with `toggleContent` (ReactNode) rather
 * than `toggleTextCollapsed`/`toggleTextExpanded` (string-only) so the toggle
 * button can carry both a visible label and a screen-reader-only label that
 * includes the pattern name for context when navigating by button.
 *
 * TODO: revert to uncontrolled once
 * https://github.com/patternfly/patternfly-react/pull/12063 lands, which will
 * allow `toggleContent` to accept a function receiving `isExpanded`.
 */
const PatternListItem = ({
  pattern,
  selection,
}: {
  pattern: Pattern;
  selection: PatternsSelection;
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const toggleContent = isExpanded ? (
    <>
      <Text srHidden>{_("Read less")}</Text>
      {/* TRANSLATORS: accessible label for the collapse button; %s is the pattern name */}
      <Text srOnly>{sprintf(_("Read less about %s"), pattern.summary)}</Text>
    </>
  ) : (
    <>
      <Text srHidden>{_("Read more")}</Text>
      {/* TRANSLATORS: accessible label for the expand button; %s is the pattern name */}
      <Text srOnly>{sprintf(_("Read more about %s"), pattern.summary)}</Text>
    </>
  );

  return (
    <ListItem>
      <Text>
        <Text isBold>{pattern.summary} </Text>
        {selection[pattern.name] === SelectedBy.AUTO && <AutoSelectedLabel />}
      </Text>
      <NestedContent margin="mxXs">
        <ExpandableSection
          variant="truncate"
          truncateMaxLines={2}
          isExpanded={isExpanded}
          onToggle={(_event, value) => setIsExpanded(value)}
          toggleContent={toggleContent}
        >
          <SubtleContent>{pattern.description}</SubtleContent>
        </ExpandableSection>
      </NestedContent>
    </ListItem>
  );
};

/**
 * List of selected patterns.
 */
const SelectedPatternsList = ({
  patterns,
  selection,
  emptyContent,
}: {
  patterns: Pattern[];
  selection: PatternsSelection;
  emptyContent: React.ReactNode;
}) => {
  if (patterns.length === 0) {
    return emptyContent;
  }

  return (
    <NestedContent margin="myMd">
      <NestedContent margin="mxSm">
        <List isPlain>
          {patterns.map((pattern) => (
            <PatternListItem key={pattern.name} pattern={pattern} selection={selection} />
          ))}
        </List>
      </NestedContent>
    </NestedContent>
  );
};

/**
 * Displays the estimated disk space required by the current software selection.
 *
 * Renders nothing when no size information is available.
 */
const SpaceRequirements = ({
  usedSize,
  hasSelection,
}: {
  usedSize?: string;
  hasSelection: boolean;
}) => {
  if (!usedSize) return;

  const text = hasSelection
    ? // TRANSLATORS: %s is the required disk space. Keep the [brackets]: they mark the value to be displayed in bold.
      sprintf(_("Required space with current selection: [%s]"), usedSize)
    : // TRANSLATORS: %s is the required disk space. Keep the [brackets]: they mark the value to be displayed in bold.
      sprintf(_("Required space: [%s]"), usedSize);

  return (
    <Text textStyle="fontSizeMd">
      <Interpolate sentence={text}>{(size) => <Text isBold>{size}</Text>}</Interpolate>
    </Text>
  );
};

type SoftwareSectionProps = {
  /** Section heading. */
  title: string;
  /** Optional explanatory text rendered below the heading. */
  description?: React.ReactNode;
  /** Label for the link that opens the pattern selection page. */
  buttonText: string;
  /** Total number of patterns in this group, selected or not. */
  totalCount: number;
  /** Patterns in this group that are currently selected. */
  patterns: Pattern[];
  /** Full selection map, used to determine how each pattern was selected. */
  selection: PatternsSelection;
  /** Content to show when no patterns are selected. */
  emptyContent: React.ReactNode;
  /** Path to the selection page linked from the section action and empty state. */
  selectionPath: string;
};

/**
 * A page section displaying a group of software patterns with a count of how
 * many are selected, an optional description, and a link to change the
 * selection.
 *
 * Shows `emptyContent` when no patterns in the group are selected.
 */
const SoftwareSection = ({
  title,
  description,
  buttonText,
  totalCount,
  patterns,
  selection,
  emptyContent,
  selectionPath,
}: SoftwareSectionProps) => {
  const noneSelected = patterns.length === 0;
  // TRANSLATORS: %1$d is selected count, %2$d is total available count
  const selected =
    !noneSelected && sprintf(_("%1$d of %2$d selected"), patterns.length, totalCount);

  return (
    <Page.Section
      title={
        <>
          {title}{" "}
          {selected && <Text textStyle={["fontSizeXs", "textColorSubtle"]}>{selected}</Text>}
        </>
      }
      description={description}
      pfCardProps={{ isFullHeight: false }}
      actions={!noneSelected && totalCount > 0 && <Link to={selectionPath}>{buttonText}</Link>}
    >
      <SelectedPatternsList patterns={patterns} selection={selection} emptyContent={emptyContent} />
    </Page.Section>
  );
};

/**
 * Main content of the software page.
 */
const SoftwarePageContent = () => {
  const { all: patterns, desktops: allDesktops, other: allOtherPatterns } = useAvailablePatterns();
  const proposal = useProposal();

  if (!proposal) {
    // TRANSLATORS: shown while the software proposal is not yet available
    return <EmptyState headingLevel="h2" titleText={_("No information available yet")} />;
  }

  const usedSize = proposal.usedSpace
    ? xbytes(proposal.usedSpace * 1024, { iec: true })
    : undefined;

  const selectedPatterns = patterns.filter((p) => isPatternSelected(proposal.patterns, p.name));
  const [desktops, otherPatterns] = fork(selectedPatterns, (p) => p.desktop);

  if (isEmpty(proposal.patterns)) return <PatternSelectionUnavailable />;

  const desktopsEmptyContent =
    allDesktops.length === 0 ? (
      <NoAvailable
        // TRANSLATORS: empty state title when no desktop environments are available
        title={_("No desktops available")}
        // TRANSLATORS: explanation shown when the product has no desktop environments
        body={_("This product does not provide desktop environments.")}
      />
    ) : (
      <NothingSelected
        to={PATHS.desktopSelection}
        // TRANSLATORS: hint shown when no desktop environment has been chosen
        body={_("Select a desktop environment to get a graphical interface.")}
        // TRANSLATORS: button to go to the desktop environment selection page
        buttonText={_("Select a desktop")}
      />
    );

  const additionalPatternsEmptyContent =
    allOtherPatterns.length === 0 ? (
      <NoAvailable
        // TRANSLATORS: empty state title when no additional patterns are available
        title={_("No additional patterns available")}
        // TRANSLATORS: explanation shown when the product has no additional patterns
        body={_("This product does not provide additional patterns.")}
      />
    ) : (
      <NothingSelected
        to={PATHS.patternsSelection}
        // TRANSLATORS: hint shown when no additional software patterns have been chosen
        body={_("Select one or more to extend the system.")}
        // TRANSLATORS: button to go to the pattern selection page
        buttonText={_("Select patterns")}
      />
    );

  return (
    <>
      <Content>
        <SpaceRequirements usedSize={usedSize} hasSelection={selectedPatterns.length > 0} />
      </Content>
      <Grid hasGutter>
        <GridItem lg={6}>
          <SoftwareSection
            title={_("Desktops")}
            description={_(
              // TRANSLATORS: description for the Desktops section
              "Graphical desktop environments for the system.",
            )}
            buttonText={
              // TRANSLATORS: button to change the desktop selection
              n_("Change desktop", "Change desktops", desktops.length)
            }
            totalCount={allDesktops.length}
            patterns={desktops}
            selection={proposal.patterns}
            selectionPath={PATHS.desktopSelection}
            emptyContent={desktopsEmptyContent}
          />
        </GridItem>
        <GridItem lg={6}>
          <SoftwareSection
            title={_("Additional patterns")}
            description={_(
              // TRANSLATORS: description for the Additional software section
              "Curated sets of packages for common use cases and features to extend the system.",
            )}
            // TRANSLATORS: button to change the additional software selection
            buttonText={_("Change patterns")}
            totalCount={allOtherPatterns.length}
            patterns={otherPatterns}
            selection={proposal.patterns}
            selectionPath={PATHS.patternsSelection}
            emptyContent={additionalPatternsEmptyContent}
          />
        </GridItem>
      </Grid>
    </>
  );
};

/**
 * Software page component
 */
function SoftwarePage() {
  const issues = useIssues("software");

  return (
    <Page breadcrumbs={[{ label: _("Software") }]} progress={{ scope: "software" }}>
      <Page.Content>
        <IssuesAlert issues={issues} />
        <SoftwarePageContent />
      </Page.Content>
    </Page>
  );
}

export default SoftwarePage;
