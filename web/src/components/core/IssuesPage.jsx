/*
 * Copyright (c) [2023] SUSE LLC
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

import React, { useCallback, useEffect, useState } from "react";

import { HelperText, HelperTextItem, Skeleton } from "@patternfly/react-core";

import { partition, useCancellablePromise } from "~/utils";
import { If, Page, Section } from "~/components/core";
import { Icon } from "~/components/layout";
import { useInstallerClient } from "~/context/installer";

/**
 * Renders an issue
 * @component
 *
 * @param {object} props
 * @param {import ("~/client/mixins").Issue} props.issue
 */
const IssueItem = ({ issue }) => {
  const variant = issue.severity === "warn" ? "warning" : "error";
  const icon = issue.severity === "warn" ? "warning" : "error";
  const hasDetails = issue.details.length > 0;

  return (
    <div>
      <HelperText className="issue">
        <HelperTextItem variant={variant} hasIcon icon={<Icon name={icon} />}>
          {issue.description}
        </HelperTextItem>
        <If
          condition={hasDetails}
          then={<HelperTextItem>{issue.details}</HelperTextItem>}
        />
      </HelperText>
    </div>
  );
};

/**
 * Generates a specific section with issues
 * @component
 *
 * @param {object} props
 * @param {import ("~/client/mixins").Issue[]} props.issues
 * @param {object} props.props
 */
const IssuesSection = ({ issues, ...props }) => {
  if (issues.length === 0) return null;

  const sortedIssues = partition(issues, i => i.severity === "error").flat();

  const issueItems = sortedIssues.map((issue, index) => {
    return <IssueItem key={`issue-${index}`} issue={issue} />;
  });

  return (
    <Section { ...props }>
      {issueItems}
    </Section>
  );
};

/**
 * Generates the sections with issues
 * @component
 *
 * @param {object} props
 * @param {import ("~/client/issues").ClientsIssues} props.issues
 */
const IssuesSections = ({ issues }) => {
  return (
    <IssuesSection
      key="storage-issues"
      title="Storage"
      icon="hard_drive"
      issues={issues.storage || []}
    />
  );
};

/**
 * Generates the content for each section with issues. If there are no issues, then a success
 * message is shown.
 * @component
 *
 * @param {object} props
 * @param {import ("~/client/issues").ClientsIssues} props.issues
 */
const IssuesContent = ({ issues }) => {
  const NoIssues = () => {
    return (
      <HelperText className="issue">
        <HelperTextItem variant="success" hasIcon icon={<Icon name="task_alt" />}>
          No issues found. Everything looks ok.
        </HelperTextItem>
      </HelperText>
    );
  };

  const allIssues = Object.values(issues).flat();

  return (
    <If
      condition={allIssues.length === 0}
      then={<NoIssues />}
      else={<IssuesSections issues={issues} />}
    />
  );
};

/**
 * Page to show all issues per section
 * @component
 */
export default function IssuesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [issues, setIssues] = useState({});
  const { issues: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();

  const loadIssues = useCallback(async () => {
    setIsLoading(true);
    const allIssues = await cancellablePromise(client.getAll());
    setIssues(allIssues);
    setIsLoading(false);
  }, [client, cancellablePromise, setIssues, setIsLoading]);

  useEffect(() => {
    loadIssues();
    return client.onIssuesChange(loadIssues);
  }, [client, loadIssues]);

  return (
    <Page
      title="Issues"
      icon="problem"
      actionLabel="Back"
      actionVariant="secondary"
      navigateTo={-1}
    >
      <If
        condition={isLoading}
        then={<Skeleton />}
        else={<IssuesContent issues={issues} />}
      />
    </Page>
  );
}
