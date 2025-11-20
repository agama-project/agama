/*
 * Copyright (c) [2023-2024] SUSE LLC
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
  Alert,
  Button,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Grid,
  GridItem,
  Spinner,
  Stack,
} from "@patternfly/react-core";
import { Link, Page, IssuesAlert } from "~/components/core";
import UsedSize from "./UsedSize";
import { useIssues } from "~/hooks/api/issue";
import {
  usePatterns,
  useSoftwareProposal,
  useSoftwareProposalChanges,
  useRepositoryMutation,
} from "~/queries/software";
import { Pattern, SelectedBy } from "~/types/software";
import { _ } from "~/i18n";
import { SOFTWARE as PATHS } from "~/routes/paths";

/**
 * List of selected patterns.
 */
const SelectedPatternsList = ({ patterns }: { patterns: Pattern[] }): React.ReactNode => {
  const selected = patterns.filter((p) => p.selectedBy !== SelectedBy.NONE);

  if (selected.length === 0) {
    return <>{_("No additional software was selected.")}</>;
  }

  return (
    <Stack hasGutter>
      <p>{_("The following software patterns are selected for installation:")}</p>
      <DescriptionList>
        {selected.map((pattern) => (
          <DescriptionListGroup key={pattern.name}>
            <DescriptionListTerm>{pattern.summary}</DescriptionListTerm>
            <DescriptionListDescription>{pattern.description}</DescriptionListDescription>
          </DescriptionListGroup>
        ))}
      </DescriptionList>
    </Stack>
  );
};

const SelectedPatterns = ({ patterns }): React.ReactNode => (
  <Page.Section
    title={_("Selected patterns")}
    actions={
      <Link to={PATHS.patternsSelection} isPrimary>
        {_("Change selection")}
      </Link>
    }
  >
    <SelectedPatternsList patterns={patterns} />
  </Page.Section>
);

const NoPatterns = (): React.ReactNode => (
  <Page.Section title={_("Selected patterns")}>
    <p>
      {_(
        "This product does not allow to select software patterns during installation. However, you can add additional software once the installation is finished.",
      )}
    </p>
  </Page.Section>
);

const errorMsg = _(
  /* TRANSLATORS: error details followed by a "Try again" link*/
  "Some installation repositories could not be loaded. \
The system cannot be installed without them.",
);

// error message, allow reloading the repositories again
const ReloadSection = ({
  loading,
  action,
}: {
  loading: boolean;
  action: () => void;
}): React.ReactNode => (
  // TRANSLATORS: title for an error message box, at least one repository could not be loaded
  <Alert variant="danger" isInline title={_("Repository load failed")}>
    {loading ? (
      <>
        {/* TRANSLATORS: progress message */}
        <Spinner size="md" /> {_("Loading the installation repositories...")}
      </>
    ) : (
      <>
        {errorMsg}{" "}
        <Button variant="link" isInline onClick={action}>
          {/* TRANSLATORS: link for retrying failed repository load */}
          {_("Try again")}
        </Button>
      </>
    )}
  </Alert>
);

/**
 * Software page component
 */
function SoftwarePage(): React.ReactNode {
  const issues = useIssues("software");
  const proposal = useSoftwareProposal();
  const patterns = usePatterns();
  // FIXME: temporarily disabled, the API end point is not implemented yet
  const repos = []; // useRepositories();

  const [loading, setLoading] = useState(false);
  const { mutate: probe } = useRepositoryMutation(() => setLoading(false));

  useSoftwareProposalChanges();

  // Selected patterns section should fill the full width in big screen too when
  // there is no information for rendering the Proposal Size section.
  const selectedPatternsXlSize = proposal.size ? 6 : 12;

  const startProbing = () => {
    setLoading(true);
    probe();
  };

  const showReposAlert = repos.some((r) => !r.loaded);

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Software")}</Content>
      </Page.Header>

      <Page.Content>
        <IssuesAlert issues={issues} />
        <Grid hasGutter>
          {showReposAlert && (
            <GridItem sm={12}>
              <ReloadSection loading={loading} action={startProbing} />
            </GridItem>
          )}
          <GridItem sm={12} xl={selectedPatternsXlSize}>
            {patterns.length === 0 ? <NoPatterns /> : <SelectedPatterns patterns={patterns} />}
          </GridItem>
          {proposal.size && (
            <GridItem sm={12} xl={6}>
              <Page.Section aria-label={_("Used space")}>
                <UsedSize size={proposal.size} />
              </Page.Section>
            </GridItem>
          )}
        </Grid>
      </Page.Content>
    </Page>
  );
}

export default SoftwarePage;
