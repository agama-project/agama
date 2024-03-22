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

// @ts-check

import React, { useEffect, useState } from "react";
import { Button } from "@patternfly/react-core";

import { If, Page, Popup, Section, SectionSkeleton } from "~/components/core";
import { PatternSelector, UsedSize } from "~/components/software";
import { useInstallerClient } from "~/context/installer";
import { noop, useCancellablePromise } from "~/utils";
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
 * Popup for selecting software patterns.
 * @component
 *
 * @param {object} props
 * @param {Pattern[]} props.patterns - List of patterns
 * @param {import("~/client/software").SoftwareProposal} props.proposal - Software proposal
 * @param {boolean} props.isOpen - Whether the pop-up should be open
 * @param {function} props.onFinish - Callback to be called when the selection is finished
 * @param {function} props.onSelectionChanged - Callback to be called when the selection changes
 */
const PatternsSelectorPopup = ({
  patterns,
  isOpen = false,
  onSelectionChanged = noop,
  onFinish = noop,
}) => {
  return (
    <Popup className="large" title={_("Software selection")} isOpen={isOpen}>
      <PatternSelector
        patterns={patterns}
        onSelectionChanged={onSelectionChanged}
      />

      <Popup.Actions>
        <Popup.PrimaryAction
          onClick={() => onFinish()}
        >
          {_("Close")}
        </Popup.PrimaryAction>
      </Popup.Actions>
    </Popup>
  );
};

const SelectPatternsButton = ({ patterns, proposal, onSelectionChanged }) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const openPopup = () => setIsPopupOpen(true);
  const closePopup = () => setIsPopupOpen(false);

  return (
    <>
      <Button
        variant="link"
        onClick={openPopup}
      >
        {_("Change selection")}
      </Button>
      <PatternsSelectorPopup
        patterns={patterns}
        proposal={proposal}
        isOpen={isPopupOpen}
        onFinish={closePopup}
        onSelectionChanged={onSelectionChanged}
      />
    </>
  );
};

/**
 * List of selected patterns.
 * @component
 * @param {object} props
 * @param {Pattern[]} props.patterns - List of patterns, including selected and unselected ones.
 * @param {import("~/client/software").SoftwareProposal} props.proposal - Software proposal
 * @param {function} props.onSelectionChanged - Callback to be called when the selection changes
 * @return {JSX.Element}
 */
const SelectedPatternsList = ({ patterns, proposal, onSelectionChanged }) => {
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
      <div>
        <SelectPatternsButton
          patterns={patterns}
          proposal={proposal}
          onSelectionChanged={onSelectionChanged}
        />
      </div>
    </>
  );
};

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

  return (
    // TRANSLATORS: page title
    <Page icon="apps" title={_("Software")}>
      {/* TRANSLATORS: page title */}
      <Section title={_("Software selection")}>
        <If
          condition={status === BUSY || isLoading}
          then={<SectionSkeleton numRows={5} />}
          else={
            <>
              <SelectedPatternsList
                patterns={patterns}
                proposal={proposal}
                onSelectionChanged={(selected) => client.software.selectPatterns(selected)}
              />

              <div>
                <UsedSize size={proposal.size} />
              </div>
            </>
          }
        />
      </Section>
    </Page>
  );
}

export default SoftwarePage;
