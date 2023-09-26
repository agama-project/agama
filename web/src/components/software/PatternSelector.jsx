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

import React, { useEffect, useState } from "react";
import { useInstallerClient } from "~/context/installer";
import PatternGroup from "./PatternGroup";

function groupPatterns(patterns) {
  // group patterns
  const pattern_groups = {};

  Object.keys(patterns).forEach((pattern) => {
    const pattern_data = patterns[pattern];
    pattern_data.push(pattern);

    if (pattern_groups[pattern_data[0]]) {
      pattern_groups[pattern_data[0]].push(pattern_data);
    } else {
      pattern_groups[pattern_data[0]] = [pattern_data];
    }
  });

  // sort patterns by the "order" value
  Object.keys(pattern_groups).forEach((group) => {
    pattern_groups[group].sort((p1, p2) => (p1[4] < p2[4] ? -1 : 1));
  });

  console.log(pattern_groups);

  return pattern_groups;
}

function patternList(patterns) {
  const groups = groupPatterns(patterns);

  const selector = Object.keys(groups).map((group) => {
    return (
      <PatternGroup
        key={group}
        name={group}
        selected={0}
        count={groups[group].length}
      >
        { (groups[group]).map(pattern => <p key={pattern[5]}><b>{pattern[3]}</b> - {pattern[1]}</p>) }
      </PatternGroup>
    );
  });

  return selector;
}

function PatternSelector() {
  const [patterns, setPatterns] = useState();
  const client = useInstallerClient();

  useEffect(() => {
    // patterns already loaded
    if (patterns) return;

    client.software.patterns(true)
      .then((pats) => {
        setPatterns(pats);
      });
  }, [patterns, client.software]);

  console.log(patterns);

  const content = (patterns)
    ? patternList(patterns)
    : <></>;

  return (
    <>
      { content }
    </>
  );
}

export default PatternSelector;
