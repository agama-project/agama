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

// @ts-check

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Section, SectionSkeleton } from "~/components/core";
import { UsedSize } from "~/components/software";
import { useInstallerClient } from "~/context/installer";
import { useCancellablePromise } from "~/utils";
import { BUSY } from "~/client/status";
import { _ } from "~/i18n";
import { SelectedBy } from "~/client/software";

/**
 * @typedef {Object} Pattern
 * @property {string} name - pattern name (internal ID)
 * @property {string} category -  pattern category
 * @property {string} summary - pattern name (user visible)
 * @property {string} description -  long description of the pattern
 * @property {number} order - display order (string!)
 * @property {number} selectedBy - who selected the pattern
 */

/**
 * Builds a list of patterns include its selection status
 *
 * @param {import("~/client/software").Pattern[]} patterns - Patterns from the HTTP API
 * @param {Object.<string, number>} selection - Patterns selection
 * @return {Pattern[]} List of patterns including its selection status
 */
function buildPatterns(patterns, selection) {
  return patterns.map((pattern) => {
    const selectedBy = (selection[pattern.name] !== undefined) ? selection[pattern.name] : 2;
    return {
      ...pattern,
      selectedBy,
    };
  }).sort((a, b) => a.order - b.order);
}

/**
 * List of selected patterns.
 * @component
 * @param {object} props
 * @param {Pattern[]} props.patterns - List of patterns, including selected and unselected ones.
 * @return {JSX.Element}
 */
const SelectedPatternsList = ({ patterns }) => {
  const selected = patterns.filter((p) => p.selectedBy !== SelectedBy.NONE);
  let description;

  if (selected.length === 0) {
    description = (
      <>
        {_("No additional software was selected.")}
      </>
    );
  } else {
    description = (
      <>
        <p>{_("The following software patterns are selected for installation:")}</p>
        <ul>
          {selected.map((pattern) => (
            <li key={pattern.name}>
              <div>
                <b>{pattern.summary}</b>
              </div>
              <div>{pattern.description}</div>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      {description}
      <Link to="patterns/select">
        {_("Change selection")}
      </Link>
    </>
  );
};

// FIXME: move build patterns to utils

/**
 * Software page component
 * @component
 * @returns {JSX.Element}
 */
function SoftwarePage() {
  const [status, setStatus] = useState(BUSY);
  const [patterns, setPatterns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [proposal, setProposal] = useState({ patterns: {}, size: "" });
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();

  useEffect(() => {
    cancellablePromise(client.software.getStatus().then(setStatus));

    return client.software.onStatusChange(setStatus);
  }, [client, cancellablePromise]);

  useEffect(() => {
    if (!patterns) return;

    return client.software.onSelectedPatternsChanged((selection) => {
      client.software.getProposal().then((proposal) => setProposal(proposal));
      setPatterns(buildPatterns(patterns, selection));
    });
  }, [client.software, patterns]);

  useEffect(() => {
    if (patterns.length !== 0) return;

    const loadPatterns = async () => {
      const patterns = await cancellablePromise(client.software.getPatterns());
      const proposal = await cancellablePromise(client.software.getProposal());
      setPatterns(buildPatterns(patterns, proposal.patterns));
      setProposal(proposal);
      setIsLoading(false);
    };

    loadPatterns();
  }, [client.software, patterns, cancellablePromise]);

  if (status === BUSY || isLoading) {
    <SectionSkeleton numRows={5} />;
  }

  return (
    <>
      <Section>
        <SelectedPatternsList patterns={patterns} />
      </Section>

      <Section>
        <UsedSize size={proposal.size} />
      </Section>
    </>
  );
}

export default SoftwarePage;
