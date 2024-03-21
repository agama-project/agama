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
import { Button, Skeleton } from "@patternfly/react-core";

import { Page, Popup, Section } from "~/components/core";
import { Center } from "~/components/layout";
import { PatternSelector, UsedSize } from "~/components/software";
import { useInstallerClient } from "~/context/installer";
import { noop, useCancellablePromise } from "~/utils";
import { BUSY } from "~/client/status";
import { _ } from "~/i18n";

/**
 * @typedef {Object} Pattern
 * @property {string} name - pattern name (internal ID)
 * @property {string} category -  pattern category
 * @property {string} summary - pattern name (user visible)
 * @property {string} description -  long description of the pattern
 * @property {number} order - display order (string!)
 * @property {number} selected_by - who selected the pattern
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
    const selected_by = (selection[pattern.name] !== undefined) ? selection[pattern.name] : 2;
    return {
      ...pattern,
      selected_by,
    };
  }).sort((a, b) => a.order - b.order);
}

/**
 * Popup for selecting software patterns.
 * @component
 *
 * @param {object} props
 * @param {Pattern[]} props.patterns - List of patterns
 * @param {boolean} props.isOpen - Whether the pop-up should be open
 * @param {function} props.onFinish - Callback to be called when the selection is finished
 */
const PatternsSelectorPopup = ({
  patterns,
  isOpen = false,
  onFinish = noop,
}) => {
  console.log("isOpen", isOpen);
  return (
    <Popup title={_("Software selection")} isOpen={isOpen}>
      <PatternSelector patterns={patterns} />

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

const SelectPatternsButton = ({ patterns }) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const openPopup = () => setIsPopupOpen(true);
  const closePopup = () => setIsPopupOpen(false);

  return (
    <>
      <Button
        variant="primary"
        onClick={openPopup}
      >
        {_("Change")}
      </Button>
      <PatternsSelectorPopup
        patterns={patterns}
        isOpen={isPopupOpen}
        onFinish={closePopup}
      />
    </>
  );
};

/**
 * Software page content depending on the current service state
 * @component
 * @param {object} props
 * @param {number} props.status - current backend service status
 * @param {string} props.used- used space in human readable format
 * @param {Pattern[]} props.patterns - patterns
 * @returns {JSX.Element}
 */
const Content = ({ patterns, status, used }) => {
  if (status === BUSY) {
    return (
      <Center>
        <Skeleton width="20%" />
        <Skeleton width="35%" />
        <Skeleton width="70%" />
        <Skeleton width="65%" />
        <Skeleton width="80%" />
        <Skeleton width="75%" />
      </Center>
    );
  }

  // return <PatternSelector />;
  return (
    <Section title={_("Software selection")} aria-label={_("List of software patterns")}>
      <UsedSize size={used} />
      <ul>
        {patterns.filter((p) => p.selected_by !== 2).map((pattern) => (
          <li key={pattern.name}>
            {pattern.summary}
          </li>
        ))}
      </ul>
      <SelectPatternsButton patterns={patterns} />
    </Section>
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
  const [used, setUsed] = useState("");
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();

  useEffect(() => {
    cancellablePromise(client.software.getStatus().then(setStatus));

    return client.software.onStatusChange(setStatus);
  }, [client, cancellablePromise]);

  useEffect(() => {
    if (!patterns) return;

    return client.software.onSelectedPatternsChanged((selection) => {
      client.software.getProposal().then(({ size }) => setUsed(size));
      setPatterns(buildPatterns(patterns, selection));
    });
  }, [client.software, patterns]);

  useEffect(() => {
    const loadPatterns = async () => {
      const patterns = await cancellablePromise(client.software.getPatterns());
      const { patterns: selection, size } = await cancellablePromise(client.software.getProposal());
      setUsed(size);
      setPatterns(buildPatterns(patterns, selection));
    };

    loadPatterns();
  }, [client.software, cancellablePromise]);

  return (
    // TRANSLATORS: page title
    <Page icon="apps" title={_("Software")}>
      <Content patterns={patterns} status={status} used={used} />
    </Page>
  );
}

export default SoftwarePage;
