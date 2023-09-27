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
import PatternItem from "./PatternItem";

function convert(pattern_data) {
  const patterns = [];

  Object.keys(pattern_data).forEach((name) => {
    const pattern = pattern_data[name];
    patterns.push({
      name,
      group: pattern[0],
      description: pattern[1],
      icon: pattern[2],
      summary: pattern[3],
      order: pattern[4]
    });
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
    pattern_groups[group].sort((p1, p2) => (p1.order < p2.order ? -1 : 1));
  });

  console.log(pattern_groups);

  return pattern_groups;
}

function patternList(patterns) {
  const groups = groupPatterns(convert(patterns));

  const selector = Object.keys(groups).map((group) => {
    return (
      <PatternGroup
        key={group}
        name={group}
        selected={0}
        count={groups[group].length}
      >
        { (groups[group]).map(p => <PatternItem key={p.name} name={p.name} summary={p.summary} description={p.description} icon={p.icon} />) }
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
