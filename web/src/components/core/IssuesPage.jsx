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

import { HelperText, HelperTextItem } from "@patternfly/react-core";

import { partition, useCancellablePromise } from "~/utils";
import { If, Page, Section, SectionSkeleton } from "~/components/core";
import { Icon } from "~/components/layout";
import { useInstallerClient } from "~/context/installer";
import { useNotification } from "~/context/notification";
import { _ } from "~/i18n";

/**
 * Item representing an issue.
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
          then={<HelperTextItem><pre>{issue.details}</pre></HelperTextItem>}
        />
      </HelperText>
    </div>
  );
};

/**
 * Generates issue items sorted by severity.
 * @component
 *
 * @param {object} props
 * @param {import ("~/client/mixins").Issue[]} props.issues
 */
const IssueItems = ({ issues = [] }) => {
  const sortedIssues = partition(issues, i => i.severity === "error").flat();

  return sortedIssues.map((issue, index) => {
    return <IssueItem key={`issue-${index}`} issue={issue} />;
  });
};

/**
 * Generates the sections with issues.
 * @component
 *
 * @param {object} props
 * @param {import ("~/client/issues").ClientsIssues} props.issues
 */
const IssuesSections = ({ issues }) => {
  const productIssues = issues.product || [];
  const storageIssues = issues.storage || [];
  const softwareIssues = issues.software || [];

  return (
    <>
      <If
        condition={productIssues.length > 0}
        then={
          <Section key="product-issues" title={_("Product")} icon="inventory_2">
            <IssueItems issues={productIssues} />
          </Section>
        }
      />
      <If
        condition={storageIssues.length > 0}
        then={
          <Section key="storage-issues" title={_("Storage")} icon="hard_drive">
            <IssueItems issues={storageIssues} />
          </Section>
        }
      />
      <If
        condition={softwareIssues.length > 0}
        then={
          <Section key="software-issues" title={_("Software")} icon="apps">
            <IssueItems issues={softwareIssues} />
          </Section>
        }
      />
    </>
  );
};

/**
 * Generates sections with issues. If there are no issues, then a success message is shown.
 * @component
 *
 * @param {object} props
 * @param {import ("~/client").Issues} props.issues
 */
const IssuesContent = ({ issues }) => {
  const NoIssues = () => {
    return (
      <HelperText className="issue">
        <HelperTextItem variant="success" hasIcon icon={<Icon name="task_alt" />}>
          {_("No issues found. Everything looks ok.")}
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
 * Page to show all issues.
 * @component
 */
export default function IssuesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [issues, setIssues] = useState();
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [notification, updateNotification] = useNotification();

  const load = useCallback(async () => {
    setIsLoading(true);
    const issues = await cancellablePromise(client.issues());
    setIsLoading(false);
    return issues;
  }, [client, cancellablePromise, setIsLoading]);

  const update = useCallback((issues) => {
    setIssues(current => ({ ...current, ...issues }));
    if (notification.issues) updateNotification({ issues: false });
  }, [notification, setIssues, updateNotification]);

  useEffect(() => {
    load().then(update);
    return client.onIssuesChange(update);
  }, [client, load, update]);

  return (
    // TRANSLATORS: page title
    <Page icon="problem" title="Issues">
      <If
        condition={isLoading}
        then={<SectionSkeleton numRows={4} />}
        else={<IssuesContent issues={issues} />}
      />
    </Page>
  );
}
