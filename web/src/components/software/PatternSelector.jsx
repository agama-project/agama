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
import { SearchInput } from "@patternfly/react-core";

import { useInstallerClient } from "~/context/installer";
import { Section, ValidationErrors } from "~/components/core";
import PatternGroup from "./PatternGroup";
import PatternItem from "./PatternItem";
import { toValidationError } from "~/utils";
import UsedSize from "./UsedSize";
import { _ } from "~/i18n";

/**
 * @typedef {Object} Pattern
 * @property {string} name pattern name (internal ID)
 * @property {string} group pattern group
 * @property {string} summary pattern name (user visible)
 * @property {string} description long description of the pattern
 * @property {string} order display order (string!)
 * @property {string} icon icon name (not path or file name!)
 * @property {number|undefined} selected who selected the pattern, undefined
 *   means it is not selected to install
 */

/**
 * Convert DBus pattern data to JS objects
 * @param {Object.<string, Array<string>>} pattern_data input pattern data
 * @param {PatternSelection} selected selected patterns
 * @returns {Array<Pattern>} converted patterns
 */
function convert(pattern_data, selected) {
  const patterns = [];

  Object.keys(pattern_data).forEach((name) => {
    const pattern = pattern_data[name];

    patterns.push({
      name,
      group: pattern[0],
      description: pattern[1],
      icon: pattern[2],
      summary: pattern[3],
      order: pattern[4],
      selected: selected[name],
    });
  });

  return patterns;
}

/**
 * @typedef {Object.<string, Array<Pattern>} PatternGroups mapping "group name" =>
 * list of patterns
 */

/**
 * Group the patterns with the same group name
 * @param {Array<Pattern>} patterns input
 * @returns {PatternGroups}
 */
function groupPatterns(patterns) {
  // group patterns
  const pattern_groups = {};

  patterns.forEach((pattern) => {
    if (pattern_groups[pattern.category]) {
      pattern_groups[pattern.category].push(pattern);
    } else {
      pattern_groups[pattern.category] = [pattern];
    }
  });

  // sort patterns by the "order" value
  Object.keys(pattern_groups).forEach((group) => {
    pattern_groups[group].sort((p1, p2) => {
      if (p1.order === p2.order) {
        // there should be no patterns with the same name
        return p1.name < p2.name ? -1 : 1;
      } else {
        // patterns with undefined (empty) order are always at the end
        if (p1.order === "") return 1;
        if (p2.order === "") return -1;

        return p1.order < p2.order ? -1 : 1;
      }
    });
  });

  return pattern_groups;
}

/**
 * Sort pattern group names
 * @param {PatternGroups} groups input
 * @returns {Array<string>} sorted pattern group names
 */
function sortGroups(groups) {
  return Object.keys(groups).sort((g1, g2) => {
    const order1 = groups[g1][0].order;
    const order2 = groups[g2][0].order;

    if (order1 === order2) {
      return g1 === g2 ? 0 : (g1 < g2 ? -1 : 1);
    }

    // patterns with undefined (empty) order are always at the end
    if (order1 === "") return 1;
    if (order2 === "") return -1;

    return order1 < order2 ? -1 : 1;
  });
}

/**
 * Pattern selector component
 * @component
 * @returns {JSX.Element}
 */
function PatternSelector() {
  const [patterns, setPatterns] = useState();
  const [visiblePatterns, setVisiblePatterns] = useState(undefined);
  const [selected, setSelected] = useState({});
  const [errors, setErrors] = useState([]);
  const [used, setUsed] = useState();
  const [searchValue, setSearchValue] = useState("");
  const client = useInstallerClient();

  const onSearchChange = (value) => {
    setSearchValue(value);
  };

  useEffect(() => {
    return client.software.onSelectedPatternsChanged(setSelected);
  }, [client.software, setSelected]);

  useEffect(() => {
    if (patterns) return;

    const loadData = async () => {
      setPatterns(await client.software.getPatterns());
      const { patterns: selected, size } = await client.software.getProposal();
      setSelected(selected);
      setUsed(size);
      setErrors(await client.software.getIssues());
    };

    loadData();
  }, [patterns, client.software]);

  useEffect(() => {
    if (!patterns) return;

    let visible = patterns.map((pattern) => {
      const selected_by = (selected[pattern.name] === undefined) ? 2 : selected[pattern.name];
      return { ...pattern, selected_by };
    });

    // filtering - search the required text in the name and pattern description
    if (searchValue !== "") {
      // case insensitive search
      const searchData = searchValue.toUpperCase();
      visible = visible.filter((p) =>
        p.name.toUpperCase().indexOf(searchData) !== -1 ||
        p.description.toUpperCase().indexOf(searchData) !== -1
      );
    }

    setVisiblePatterns(visible);
  }, [patterns, selected, searchValue]);

  const onToggle = useCallback((name) => {
    const selected = visiblePatterns.filter((p) => p.selected_by === 0).map((p) => p.name);

    const index = selected.indexOf(name);
    if (index === -1) {
      selected.push(name);
    } else {
      selected.splice(index, 1);
    }

    client.software.selectPatterns(selected);
  }, [visiblePatterns, client.software]);

  // initial empty screen, the patterns are loaded very quickly, no need for any progress
  if (!visiblePatterns) return null;

  const groups = groupPatterns(visiblePatterns);
  const selector = sortGroups(groups).map((group) => {
    return (
      <PatternGroup
        key={group}
        name={group}
      >
        {groups[group].map((p) => (
          <PatternItem
            key={p.name}
            pattern={p}
            onToggle={(name) => onToggle(name)}
          />
        ))}
      </PatternGroup>
    );
  });

  // FIXME: ValidationErrors should be replaced by an equivalent component to show issues.
  // Note that only the Users client uses the old Validation D-Bus interface.
  const validationErrors = errors.map(toValidationError);

  return (
    <>
      <Section aria-label={_("Software summary and filter options")}>
        <UsedSize size={used} />
        <ValidationErrors errors={validationErrors} sectionId="software" />
        <SearchInput
          // TRANSLATORS: search field placeholder text
          placeholder={_("Search")}
          aria-label={_("Search")}
          value={searchValue}
          onChange={(_event, value) => onSearchChange(value)}
          onClear={() => onSearchChange("")}
          // do not display the counter when search filter is empty
          resultsCount={searchValue === "" ? 0 : groups.length}
        />
      </Section>

      {selector}
    </>
  );
}

export default PatternSelector;
