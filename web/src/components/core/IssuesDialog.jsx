/*
 * Copyright (c) [2023-2024] SUSE LLC
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
import { Popup } from "~/components/core";
import { Icon } from "~/components/layout";
import { _ } from "~/i18n";
import { useInstallerClient } from "~/context/installer";
import { partition, useCancellablePromise } from "~/utils";

/**
 * Item representing an issue.
 * @component
 *
 * @param {object} props
 * @param {import ("~/client/mixins").Issue} props.issue
 */
const IssueItem = ({ issue }) => {
  return (
    <li>
      {issue.description}
      {issue.details && <pre>{issue.details}</pre>}
    </li>
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

  const items = sortedIssues.map((issue, index) => {
    return <IssueItem key={`issue-${index}`} issue={issue} />;
  });

  return <ul>{items}</ul>;
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
 * @param {string} props.sectionId - A string which indicates what type of issues are going to be shown in the popup.
 * @param {string} props.title - Title of the popup.
 */
export default function IssuesDialog({ isOpen = false, onClose, sectionId, title }) {
  const [isLoading, setIsLoading] = useState(true);
  const [issues, setIssues] = useState([]);
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();

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
      title={title}
      data-content="issues-summary"
    >
      {isLoading ? <Icon name="loading" className="icon-xxxl" /> : <IssueItems issues={issues} />}
      <Popup.Actions>
        <Popup.Confirm onClick={onClose} autoFocus>{_("Close")}</Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
}
