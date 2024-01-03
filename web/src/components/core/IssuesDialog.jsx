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
import { If, Section, Popup } from "~/components/core";
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
  const hasDetails = issue.details.length > 0;

  return (
    <div>
      <HelperText className="issue">
        <HelperTextItem>
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
 * @param {string} props.sectionId - A string which indicites which issues section should be highlighted.
 */
const IssuesSections = ({ issues }) => {
  return (
    /* TRANSLATORS: Aria label */
    <Section aria-label={_("List of issues")}>
      <IssueItems issues={issues} />
    </Section>
  );
};

/**
 * Generates sections with issues. If there are no issues, then a success message is shown.
 * @component
 *
 * @param {object} props
 * @param {import ("~/client").Issues} props.issues
 * @param {string} props.sectionId - A string which indicites which issues section should be highlighted.
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
 * Popup to show more issues details from the installation overview page.
 *
 * It initially shows a loading state,
 * then fetches and displays a list of issues of the selected category, either 'product' or 'storage' or 'software'.
 *
 * It uses a Popup component to display the issues, and an If component to toggle between
 * a loading state and the content state.
 *
 * @component
 *
 * @param {object} props
 * @param {boolean} [props.isOpen] - A boolean value used to determine wether to show the popup or not.
 * @param {function} props.onClose - A function to call when the close action is triggered.
 * @param {string} props.sectionId - A string which indicites which type of issues is going to be shown in the popup.
 */
export default function IssuesDialog({ isOpen = false, onClose, sectionId }) {
  const [isLoading, setIsLoading] = useState(true);
  const [issues, setIssues] = useState([]);
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const titles = {
    software: {
      text: _("Software issues"),
      icon: () => <Icon name="apps" />
    },
    product: {
      text: _("Product issues"),
      icon: () => <Icon name="inventory_2" />
    },
    storage: {
      text: _("Storage issues"),
      icon: () => <Icon name="hard_drive" />
    }
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    const issues = await cancellablePromise(client.issues());
    setIsLoading(false);
    return issues;
  }, [client, cancellablePromise, setIsLoading]);

  const update = useCallback((issues) => {
    setIssues(current => ([...current, ...(issues[sectionId] || [])]));
  }, [setIssues, sectionId]);

  useEffect(() => {
    load().then(update);
    return client.onIssuesChange(update);
  }, [client, load, update]);

  return (
    <Popup
      isOpen={isOpen}
      title={titles[sectionId].text}
      titleIconVariant={titles[sectionId].icon}
      data-content="issues-summary"
    >
      <If
        condition={isLoading}
        then={<Icon name="loading" className="icon-big" />}
        else={<IssuesContent issues={issues} />}
      />
      <Popup.Actions>
        <Popup.Confirm onClick={onClose} autoFocus>{_("Close")}</Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
}
