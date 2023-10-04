/*
 * Copyright (c) [2022] SUSE LLC
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
import { sprintf } from "sprintf-js";

import { useInstallerClient } from "~/context/installer";
import { Section } from "~/components/core";
import PatternGroup from "./PatternGroup";
import PatternItem from "./PatternItem";
import UsedSize from "./UsedSize";
import { _ } from "~/i18n";

function convert(pattern_data, selected) {
  console.log("selected: ", selected);

  const patterns = [];

  Object.keys(pattern_data).forEach((name) => {
    const pattern = pattern_data[name];

    if (pattern[4] > 0) {
      patterns.push({
        name,
        group: pattern[0],
        description: pattern[1],
        icon: pattern[2],
        summary: pattern[3],
        order: pattern[4],
        selected: selected[name]
      });
    }
  });

  return patterns;
}

function groupPatterns(patterns) {
  // group patterns
  const pattern_groups = {};

  patterns.forEach((pattern) => {
    if (pattern_groups[pattern.group]) {
      pattern_groups[pattern.group].push(pattern);
    } else {
      pattern_groups[pattern.group] = [pattern];
    }
  });

  // sort patterns by the "order" value
  Object.keys(pattern_groups).forEach((group) => {
    pattern_groups[group].sort((p1, p2) => p1.order === p2.order ? (p1.name < p2.name) : (p1.order < p2.order ? -1 : 1));
  });

  return pattern_groups;
}

function sortGroups(groups) {
  return Object.keys(groups).sort((g1, g2) => {
    const order1 = groups[g1][0].order;
    const order2 = groups[g2][0].order;

    if (order1 === order2) {
      return g1 === g2 ? 0 : (g1 < g2 ? -1 : 1);
    }

    return order1 < order2 ? -1 : 1;
  });
}

function PatternSelector() {
  const [patterns, setPatterns] = useState();
  const [selected, setSelected] = useState();
  const [used, setUsed] = useState();
  const [searchValue, setSearchValue] = useState("");
  const client = useInstallerClient();

  const onSearchChange = (value) => {
    setSearchValue(value);
  };

  const refreshCb = useCallback(() => {
    client.software.selectedPatterns().then((sel) => setSelected(sel));
    client.software.getUsedSpace().then((sp) => setUsed(sp));
  }, [client.software]);

  useEffect(() => {
    // patterns already loaded
    if (patterns) return;

    const refresh = async () => {
      setPatterns(await client.software.patterns(true));
      setSelected(await client.software.selectedPatterns());
      setUsed(await client.software.getUsedSpace());
    };

    refresh();
  }, [patterns, client.software]);

  if (!patterns || !selected) {
    return <></>;
  }

  let patternsData = convert(patterns, selected);
  const numSelected = patternsData.reduce((acc, pat) => acc + (pat.selected === undefined ? 0 : 1), 0);

  if (searchValue !== "") {
    const searchData = searchValue.toUpperCase();
    patternsData = patternsData.filter((p) =>
      p.name.toUpperCase().indexOf(searchData) !== -1 ||
      p.description.toUpperCase().indexOf(searchData) !== -1
    );
  }

  const groups = groupPatterns(patternsData);
  console.log("patterns: ", groups);

  const sortedGroups = sortGroups(groups);
  console.log("sorted groups: ", sortedGroups);

  const selector = sortGroups(groups).map((group) => {
    return (
      <PatternGroup
        key={group}
        name={group}
      >
        { (groups[group]).map(p => <PatternItem key={p.name} pattern={p} onChange={refreshCb} />) }
      </PatternGroup>
    );
  });

  return (
    <>
      <Section title={_("Selected Software")} icon="apps">
        <UsedSize size={used} />
        <div> { sprintf(_("Selected %d patterns"), numSelected) } </div>
        <h2>{_("Filter")}</h2>
        <SearchInput
          placeholder={_("Search")}
          value={searchValue}
          onChange={(_event, value) => onSearchChange(value)}
          onClear={() => onSearchChange("")}
          resultsCount={searchValue === "" ? 0 : patternsData.length}
        />

        { selector }
      </Section>
    </>
  );
}

export default PatternSelector;
