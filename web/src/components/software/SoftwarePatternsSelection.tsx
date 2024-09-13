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
import { Page } from "~/components/core";
import { useConfigMutation, usePatterns } from "~/queries/software";
import { Pattern, SelectedBy } from "~/types/software";
import { _ } from "~/i18n";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";

/**
 * PatternGroups mapping "group name" => list of patterns
 */
type PatternsGroups = { [key: string]: Pattern[] };

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

const filterPatterns = (patterns: Pattern[] = [], searchValue = ""): Pattern[] => {
  if (searchValue.trim() === "") return patterns;

  // case insensitive search
  const searchData = searchValue.toUpperCase();
  return patterns.filter(
    (p) =>
      p.name.toUpperCase().indexOf(searchData) !== -1 ||
      p.description.toUpperCase().indexOf(searchData) !== -1,
  );
};

const NoMatches = (): React.ReactNode => <b>{_("None of the patterns match the filter.")}</b>;

/**
 * Pattern selector component
 */
function SoftwarePatternsSelection(): React.ReactNode {
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
      <section key={groupName}>
        <h3>{groupName}</h3>
        <DataList isCompact aria-label={groupName}>
          {groups[groupName].map((option) => {
            const titleId = `${option.name}-title`;
            const descId = `${option.name}-desc`;
            const selected = selectedIds.includes(option.name);
            const nextActionId = `${option.name}-next-action`;

            return (
              <DataListItem key={option.name} aria-labelledby={titleId} aria-describedby={descId}>
                <DataListItemRow>
                  <DataListCheck
                    onChange={() => onToggle(option.name)}
                    aria-labelledby={[nextActionId, titleId].join(" ")}
                    isChecked={selected}
                  />
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key="summary">
                        <Stack hasGutter>
                          <div>
                            <b id={titleId}>{option.summary}</b>{" "}
                            {option.selectedBy === SelectedBy.AUTO && (
                              <Label color="blue" isCompact>
                                {_("auto selected")}
                              </Label>
                            )}
                            <span id={nextActionId} className={a11yStyles.hidden}>
                              {selected ? _("Unselect") : _("Select")}
                            </span>
                          </div>
                          <div id={descId}>{option.description}</div>
                        </Stack>
                      </DataListCell>,
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
            );
          })}
        </DataList>
      </section>
    );
  });

  return (
    <Page>
      <Page.Header>
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
      </Page.Header>

      <Page.Content>
        <Page.Section>
          {selector.length > 0 ? <Stack hasGutter>{selector}</Stack> : <NoMatches />}
        </Page.Section>
      </Page.Content>

      <Page.Actions>
        <Page.Cancel>{_("Close")}</Page.Cancel>
      </Page.Actions>
    </Page>
  );
}

export default SoftwarePatternsSelection;
