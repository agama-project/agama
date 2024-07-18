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

import React, { useState } from "react";
import {
  Card,
  CardBody,
  Label,
  DataList,
  DataListCell,
  DataListCheck,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  SearchInput,
  Stack,
} from "@patternfly/react-core";
import { Section, Page } from "~/components/core";
import { SelectedBy } from "~/types/software";
import { useConfigMutation, usePatterns } from "~/queries/software";
import { _ } from "~/i18n";

/**
 * Group the patterns with the same group name
 */
function groupPatterns(patterns: Pattern[]): PatternsGroups {
  const groups = {};

  patterns.forEach((pattern) => {
    if (groups[pattern.category]) {
      groups[pattern.category].push(pattern);
    } else {
      groups[pattern.category] = [pattern];
    }
  });

  // sort patterns by the "order" value
  Object.keys(groups).forEach((group) => {
    groups[group].sort((p1, p2) => {
      if (p1.order === p2.order) {
        // there should be no patterns with the same name
        return p1.name < p2.name ? -1 : 1;
      } else {
        return p1.order - p2.order;
      }
    });
  });

  return groups;
}

/**
 * Sort pattern group names
 */
function sortGroups(groups: PatternsGroups): string[] {
  return Object.keys(groups).sort((g1, g2) => {
    const order1 = groups[g1][0].order;
    const order2 = groups[g2][0].order;
    return order1 - order2;
  });
}

const filterPatterns = (patterns: Pattern[] = [], searchValue = "") => {
  if (searchValue.trim() === "") return patterns;

  // case insensitive search
  const searchData = searchValue.toUpperCase();
  return patterns.filter(
    (p) =>
      p.name.toUpperCase().indexOf(searchData) !== -1 ||
      p.description.toUpperCase().indexOf(searchData) !== -1,
  );
};

const NoMatches = () => <b>{_("None of the patterns match the filter.")}</b>;

/**
 * Pattern selector component
 */
function SoftwarePatternsSelection() {
  const patterns = usePatterns();
  const config = useConfigMutation();
  const [searchValue, setSearchValue] = useState("");

  const onToggle = (name: string) => {
    const selected = patterns
      .filter((p) => p.selectedBy === SelectedBy.USER)
      .reduce((all, p) => {
        all[p.name] = true;
        return all;
      }, {});
    const pattern = patterns.find((p) => p.name === name);
    selected[name] = pattern.selectedBy === SelectedBy.NONE;

    config.mutate({ patterns: selected });
  };

  // FIXME: use loading indicator when busy, we cannot know if it will be
  // quickly or not in advance.

  // initial empty screen, the patterns are loaded very quickly, no need for any progress
  const visiblePatterns = filterPatterns(patterns, searchValue);
  if (visiblePatterns.length === 0 && searchValue === "") return null;

  const groups = groupPatterns(visiblePatterns);

  // FIXME: use a switch instead of a checkbox since these patterns are going to
  // be selected/deselected immediately.
  // TODO: extract to a DataListSelector component or so.
  const selector = sortGroups(groups).map((groupName) => {
    const selectedIds = groups[groupName]
      .filter((p) => p.selectedBy !== SelectedBy.NONE)
      .map((p) => p.name);
    return (
      <Section key={groupName} title={groupName}>
        <DataList isCompact aria-label={groupName}>
          {groups[groupName].map((option) => (
            <DataListItem key={option.name}>
              <DataListItemRow>
                <DataListCheck
                  onChange={() => onToggle(option.name)}
                  aria-labelledby="check-action-item1"
                  name="check-action-check1"
                  isChecked={selectedIds.includes(option.name)}
                />
                <DataListItemCells
                  dataListCells={[
                    <DataListCell key="summary">
                      <Stack hasGutter>
                        <div>
                          <b>{option.summary}</b>{" "}
                          {option.selectedBy === SelectedBy.AUTO && (
                            <Label color="blue" isCompact>
                              {_("auto selected")}
                            </Label>
                          )}
                        </div>
                        <div>{option.description}</div>
                      </Stack>
                    </DataListCell>,
                  ]}
                />
              </DataListItemRow>
            </DataListItem>
          ))}
        </DataList>
      </Section>
    );
  });

  return (
    <>
      <Page.Header>
        <Stack hasGutter>
          <h2>{_("Software selection")}</h2>
          <SearchInput
            // TRANSLATORS: search field placeholder text
            placeholder={_("Filter by pattern title or description")}
            aria-label={_("Filter by pattern title or description")}
            value={searchValue}
            onChange={(_event, value) => setSearchValue(value)}
            onClear={() => setSearchValue("")}
            resultsCount={visiblePatterns.length}
          />
        </Stack>
      </Page.Header>

      <Page.MainContent>
        <Card isRounded>
          <CardBody>{selector.length > 0 ? selector : <NoMatches />}</CardBody>
        </Card>
      </Page.MainContent>

      <Page.NextActions>
        <Page.Action navigateTo="..">{_("Close")}</Page.Action>
      </Page.NextActions>
    </>
  );
}

export default SoftwarePatternsSelection;
