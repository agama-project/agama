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

import React, { useCallback, useEffect, useRef, useState } from "react";

import { HelperText, HelperTextItem } from "@patternfly/react-core";

import { partition, useCancellablePromise } from "~/utils";
import { If, Section, SectionSkeleton, Popup } from "~/components/core";
import { Icon } from "~/components/layout";
import { useInstallerClient } from "~/context/installer";
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
 * @param {string} [props.sectionHighlight] - A string which indicites which issues section should be highlighted.
 */
const IssuesSections = ({ issues, sectionHighlight = "" }) => {
  const productIssues = issues.product || [];
  const storageIssues = issues.storage || [];
  const softwareIssues = issues.software || [];
  const productSectionRef = useRef(null);
  const storageSectionRef = useRef(null);
  const softwareSectionRef = useRef(null);

  useEffect(() => {
    let selectedRef;
    switch (sectionHighlight) {
      case 'Product':
        selectedRef = productSectionRef;
        break;
      case 'Storage':
        selectedRef = storageSectionRef;
        break;
      case 'Software':
        selectedRef = softwareSectionRef;
        break;
      default:
        selectedRef = null;
    }

    if (selectedRef && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sectionHighlight]);

  return (
    <>
      <If
        condition={productIssues.length > 0}
        then={
          <div ref={productSectionRef}>
            <Section
              key="product-issues"
              title={_("Product")}
              icon="inventory_2"
              className={sectionHighlight === "Product" ? "highlighted" : ""}
            >
              <IssueItems issues={productIssues} />
            </Section>
          </div>
        }
      />
      <If
        condition={storageIssues.length > 0}
        then={
          <div ref={storageSectionRef}>
            <Section
              key="storage-issues"
              title={_("Storage")}
              icon="hard_drive"
              className={sectionHighlight === "Storage" ? "highlighted" : ""}
            >
              <IssueItems issues={storageIssues} />
            </Section>
          </div>
        }
      />
      <If
        condition={softwareIssues.length > 0}
        then={
          <div ref={softwareSectionRef}>
            <Section
              key="software-issues"
              title={_("Software")}
              icon="apps"
              className={sectionHighlight === "Software" ? "highlighted" : ""}
            >
              <IssueItems issues={softwareIssues} />
            </Section>
          </div>
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
 * @param {string} [props.sectionHighlight] - A string which indicites which issues section should be highlighted.
 */
const IssuesContent = ({ issues, sectionHighlight = "" }) => {
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
      else={<IssuesSections issues={issues} sectionHighlight={sectionHighlight} />}
    />
  );
};

/**
 * Page to show all issues.
 *
 * It initially shows a loading state,
 * then fetches and displays a list of issues grouped by categories such as 'product', 'storage', and 'software'.
 *
 * It uses a Popup component to display the issues, and an If component to toggle between
 * a loading state and the content state.
 *
 * @component
 *
 * @param {object} props
 * @param {function} props.close - A function to call when the close action is triggered.
 * @param {string} [props.sectionHighlight] - A string which indicites which issues section should be highlighted.
 */
export default function IssuesDialog({ close, sectionHighlight = "" }) {
  const [isLoading, setIsLoading] = useState(true);
  const [issues, setIssues] = useState();
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();

  const load = useCallback(async () => {
    setIsLoading(true);
    const issues = await cancellablePromise(client.issues());
    setIsLoading(false);
    return issues;
  }, [client, cancellablePromise, setIsLoading]);

  const update = useCallback((issues) => {
    setIssues(current => ({ ...current, ...issues }));
  }, [setIssues]);

  useEffect(() => {
    load().then(update);
    return client.onIssuesChange(update);
  }, [client, load, update]);

  return (
    <Popup isOpen title={_("Issues")}>
      <If
        condition={isLoading}
        then={<SectionSkeleton numRows={4} />}
        else={<IssuesContent issues={issues} sectionHighlight={sectionHighlight} />}
      />
      <Popup.Actions>
        <Popup.Confirm onClick={close} autoFocus>{_("Close")}</Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
}
