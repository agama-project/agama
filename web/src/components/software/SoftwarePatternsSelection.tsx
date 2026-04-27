/*
 * Copyright (c) [2023-2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

import React, { useLayoutEffect, useRef, useState } from "react";
import {
  ActionGroup,
  Checkbox,
  Flex,
  Form,
  PageSection,
  SearchInput,
  Stack,
  Title,
} from "@patternfly/react-core";
import { group, sort } from "radashi";
import { sprintf } from "sprintf-js";
import { formOptions } from "@tanstack/react-form";
import { useNavigate } from "react-router";
import NestedContent from "~/components/core/NestedContent";
import Page from "~/components/core/Page";
import SubtleContent from "~/components/core/SubtleContent";
import Text from "~/components/core/Text";
import AutoSelectedLabel from "~/components/software/AutoSelectedLabel";
import { SelectedBy } from "~/model/proposal/software";
import { patchConfig } from "~/api";
import { useSystem } from "~/hooks/model/system/software";
import { useProposal } from "~/hooks/model/proposal/software";
import { usePristineSafeForm } from "~/hooks/form";
import { filterPatterns, groupPatterns, isPatternSelected, sortGroupNames } from "~/utils/software";
import { SOFTWARE } from "~/routes/paths";
import { N_, _, n_ } from "~/i18n";

import type { Pattern } from "~/model/system/software";

const softwarePatternsFormOptions = formOptions({
  defaultValues: {},
});

/**
 * Controls which patterns the selection page shows.
 * - "all": all available patterns
 * - "desktops": only patterns representing desktop environments
 * - "other": non-desktop patterns
 */
type Scope = "all" | "desktops" | "other";

/**
 * Resolves what action, if any, a pattern should produce on submit.
 *
 * Visible patterns (inScope):
 * - "add" when checked AND there is clear user intent: the user just toggled it,
 *   or it was already their explicit choice. Avoids re-adding auto-selected patterns
 *   the user never touched.
 * - "remove" when unchecked AND previously relevant: selected on load, a product
 *   default, or already explicitly removed. Patterns never seen before are ignored.
 * - null otherwise.
 *
 * Hidden patterns (not inScope) pass through their existing user selection unchanged,
 * preserving choices made on a different scope. The proposal's selection status is
 * the source of truth: USER means the user explicitly added it, REMOVED means the
 * user explicitly removed it.
 *
 * @param inScope - Whether the pattern is visible in the current scope
 * @param isChecked - Current checkbox value in the form
 * @param isDirty - Whether the user changed the checkbox from its initial value
 * @param isPreselected - Whether the pattern is selected by default in the product
 * @param wasInitiallySelected - Whether the pattern was selected when the form loaded
 * @param selectionStatus - Current backend selection status for this pattern
 */
const resolvePatternAction = (
  inScope: boolean,
  isChecked: boolean,
  isDirty: boolean,
  isPreselected: boolean,
  wasInitiallySelected: boolean,
  selectionStatus: SelectedBy | undefined,
): "add" | "remove" | undefined => {
  if (!inScope) {
    if (selectionStatus === SelectedBy.USER) return "add";
    if (selectionStatus === SelectedBy.REMOVED) return "remove";
    return;
  }
  if (isChecked && (isDirty || selectionStatus === SelectedBy.USER)) return "add";
  if (
    !isChecked &&
    (wasInitiallySelected || isPreselected || selectionStatus === SelectedBy.REMOVED)
  )
    return "remove";
};

/** Values use `N_()` for extraction. Translate with `_()` at render time. */
const PAGE_TITLE: Record<Scope, string> = {
  // TRANSLATORS: page title when selecting all software patterns
  all: N_("Patterns selection"),
  // TRANSLATORS: page title when selecting desktop environments
  desktops: N_("Desktop selection"),
  // TRANSLATORS: page title when selecting non-desktop software patterns
  other: N_("Patterns selection"),
};

type CategoryCounterProps = {
  /** All patterns in the category, regardless of the active filter. */
  patterns: Pattern[];
  /** Number of patterns from `patterns` that match the active filter. */
  matchCount: number;
  /** Whether the user has typed something in the search input. */
  isFiltering: boolean;
  /** Live selection map (pattern name -> checked) from the form state. */
  formValues: Record<string, boolean>;
};

/**
 * Inline subtle counter rendered next to a category heading.
 *
 * Always shows "X of Y selected" so the user can see selections persist even
 * when the filter hides patterns. When the filter is active, appends either "N
 * match the filter" (visible subset) or "No patterns match the filter" (empty
 * subset), avoiding a redundant placeholder in the body below.
 */
const CategoryCounter = ({
  patterns,
  matchCount,
  isFiltering,
  formValues,
}: CategoryCounterProps) => {
  const selectedCount = patterns.filter((p) => formValues[p.name]).length;
  // TRANSLATORS: %1$d is selected count, %2$d is total available count
  const selectedText = sprintf(_("%1$d of %2$d selected"), selectedCount, patterns.length);

  if (!isFiltering) {
    return <Text textStyle={["fontSizeSm", "textColorSubtle"]}>{selectedText}</Text>;
  }

  const matchText =
    matchCount === 0
      ? // TRANSLATORS: shown next to a category heading when the search filter excludes all its patterns
        _("No patterns match the filter")
      : // TRANSLATORS: count of patterns matching the search filter in this category
        sprintf(n_("%d matches the filter", "%d match the filter", matchCount), matchCount);

  return (
    <Flex spaceItems={{ default: "spaceItemsMd" }}>
      <Text textStyle={["fontSizeSm", "textColorSubtle"]}>{selectedText}</Text>
      <Text textStyle={["fontSizeXs", "textColorSubtle"]}>{matchText}</Text>
    </Flex>
  );
};

type PatternCheckboxProps = {
  /** Checkbox input id */
  id: string;
  /** Pattern title displayed next to the checkbox */
  label: string;
  /** Optional pattern description shown below */
  description?: string;
  /** Whether the checkbox is checked */
  isChecked: boolean;
  /** Called when the checkbox value changes */
  onChange: (checked: boolean) => void;
  /**
   * Optional non-interactive content (e.g., badge, icon) rendered next to the label.
   * Sits outside the clickable label area, so clicking it won't toggle the checkbox.
   */
  extra?: React.ReactNode;
};

/**
 * Internal checkbox component with external label structure.
 *
 * Unlike PatternFly's standard Checkbox component (where the `label` prop
 * creates a clickable area that includes all its content), this component uses
 * an external `<label htmlFor={id}>` element, allowing non-interactive content
 * to be placed alongside the label without being part of the click target.
 *
 * **Structure:**
 * - Outer Flex (column): checkbox row + description
 * - Inner Flex (row): checkbox + label + extra content
 * - Checkbox without label/description props (input only)
 * - External `<label htmlFor={id}>` that targets the checkbox input
 * - Extra content outside the label (truly non-interactive)
 * - Description indented to align with label text
 *
 * **Use case:** When you need to display supplementary information (badges, icons)
 * next to a checkbox label without making that information clickable.
 *
 * **Note:** If this pattern is needed elsewhere in the codebase, consider extracting
 * to `components/form/` with proper TanStack Form integration.
 *
 * @example
 * ```tsx
 * <PatternCheckbox
 *   id="pattern-gnome"
 *   label="GNOME Desktop"
 *   description="Modern desktop environment"
 *   isChecked={isSelected}
 *   onChange={setSelected}
 *   extra={<AutoSelectedLabel />}
 * />
 * ```
 */
const PatternCheckbox = ({
  id,
  label,
  description,
  isChecked,
  onChange,
  extra,
}: PatternCheckboxProps) => {
  return (
    <Flex direction={{ default: "column" }} spaceItems={{ default: "spaceItemsXs" }}>
      <Flex spaceItems={{ default: "spaceItemsSm" }} alignItems={{ default: "alignItemsFlexEnd" }}>
        <Checkbox id={id} isChecked={isChecked} onChange={(_, checked) => onChange(checked)} />
        <label htmlFor={id}>
          <Text textStyle="fontSizeMd">{label}</Text>
        </label>
        {extra}
      </Flex>
      {description && (
        <NestedContent margin="mlLg">
          <SubtleContent>{description}</SubtleContent>
        </NestedContent>
      )}
    </Flex>
  );
};

/**
 * Pattern selector component.
 *
 * @param scope - Which patterns to show: "all", "desktops", or "other" (non-desktop patterns).
 *   Defaults to "all".
 */
function SoftwarePatternsSelection({ scope = "all" }: { scope?: Scope }) {
  const navigate = useNavigate();
  const { patterns: systemPatterns } = useSystem();
  const proposal = useProposal();
  const selection = proposal?.patterns || {};
  const [searchValue, setSearchValue] = useState("");

  // Category headers stick below the filter as the user scrolls. To position
  // them correctly, we need the filter's height. We measure it dynamically
  // because the filter might wrap differently at various viewport widths or
  // when showing the results count badge.
  //
  // useLayoutEffect fires synchronously after DOM mutations but before paint,
  // so the measurement completes before the browser renders. This prevents
  // visual flicker that would occur with useEffect (which fires after paint).
  //
  // We re-measure when searchValue changes because the SearchInput's results
  // count can affect the filter's height (wrapping on narrow viewports).
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState(0);

  useLayoutEffect(() => {
    if (filterRef.current) {
      setFilterHeight(filterRef.current.offsetHeight);
    }
  }, [searchValue]);

  let scopedPatterns: Pattern[];
  switch (scope) {
    case "desktops":
      scopedPatterns = systemPatterns.filter((p) => p.desktop);
      break;
    case "other":
      scopedPatterns = systemPatterns.filter((p) => !p.desktop);
      break;
    default:
      scopedPatterns = systemPatterns;
  }

  // Build initial form values: each pattern name -> selected boolean
  const initialValues = scopedPatterns.reduce((acc, pattern) => {
    acc[pattern.name] = isPatternSelected(selection, pattern.name);
    return acc;
  }, {});

  const form = usePristineSafeForm({
    ...softwarePatternsFormOptions,
    defaultValues: initialValues,
    onSubmit: async ({ value: formValues, formApi }) => {
      const { add, remove } = systemPatterns.reduce(
        (acc, p) => {
          const inScope = p.name in initialValues;
          const isChecked = formValues[p.name];
          const isDirty = formApi.getFieldMeta(p.name)?.isDirty ?? false;
          const wasInitiallySelected = initialValues[p.name];
          const selectionStatus = selection[p.name];

          const action = resolvePatternAction(
            inScope,
            isChecked,
            isDirty,
            p.preselected,
            wasInitiallySelected,
            selectionStatus,
          );

          if (action) acc[action].push(p.name);
          return acc;
        },
        { add: [], remove: [] },
      );

      await patchConfig({ software: { patterns: { add, remove } } });
    },
    onSubmitComplete: () => navigate(SOFTWARE.root),
  });

  // Initial empty screen guard: patterns load very quickly, but on the very
  // first render the system list may be empty. Avoid flashing an empty page.
  if (scopedPatterns.length === 0 && searchValue === "") return null;

  // Build the canonical category list from the unfiltered scope so categories
  // never disappear as the user types.
  const sortedPatterns = sort(scopedPatterns, (p) => p.order);
  const allGroups = groupPatterns(sortedPatterns);
  const visiblePatterns = filterPatterns(sortedPatterns, searchValue);
  const visibleByCategory = group(visiblePatterns, (p) => p.category);
  const isFiltering = searchValue.trim() !== "";

  // TRANSLATORS: screen reader announcement when filter results change.
  // %d is the number of patterns matching the current filter.
  const filterAnnouncement = isFiltering
    ? sprintf(
        n_("%d pattern found", "%d patterns found", visiblePatterns.length),
        visiblePatterns.length,
      )
    : "";

  let filterResultsCount: string | undefined;
  if (isFiltering) {
    filterResultsCount =
      visiblePatterns.length === 0
        ? // TRANSLATORS: search results badge on the filter input when no pattern matches
          _("No patterns match")
        : // TRANSLATORS: search results badge on the filter input.
          // %1$d is matches found, %2$d is the total number of patterns.
          sprintf(_("%1$d of %2$d patterns"), visiblePatterns.length, sortedPatterns.length);
  }

  return (
    <Page
      breadcrumbs={[
        { label: _("Software"), path: SOFTWARE.root },
        {
          // TRANSLATORS: breadcrumb label for the pattern/desktop selection page
          // eslint-disable-next-line agama-i18n/string-literals
          label: _(PAGE_TITLE[scope]),
        },
      ]}
      progress={{ scope: "software" }}
    >
      <Page.Content>
        <form.AppForm>
          {/* TODO: extract to global ARIA live region for announcements.
              Screen reader users need feedback when filter results change, but
              each component creating its own live region is not ideal. A single
              global announcements region would be more maintainable and avoid
              potential conflicts. */}
          <div aria-live="polite" aria-atomic="true" className="pf-v6-u-screen-reader">
            {filterAnnouncement}
          </div>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <PageSection
              component="div"
              stickyOnBreakpoint={{ default: "top" }}
              padding={{ default: "noPadding" }}
              style={{
                background: "var(--pf-t--global--background--color--primary--default)",
                zIndex: 3,
              }}
            >
              <div ref={filterRef}>
                <SearchInput
                  // TRANSLATORS: placeholder for the search field on the patterns selection page
                  placeholder={_("Filter by name and description")}
                  // SearchInput defaults aria-label to "Search input"; override for clarity.
                  aria-label={_("Filter by name and description")}
                  value={searchValue}
                  onChange={(_event, value) => setSearchValue(value)}
                  onClear={() => setSearchValue("")}
                  resultsCount={filterResultsCount}
                />
              </div>
            </PageSection>

            <form.Subscribe
              selector={(s) => ({
                values: s.values as Record<string, boolean>,
                fieldMeta: s.fieldMeta,
              })}
            >
              {({ values: formValues, fieldMeta }) => (
                <Stack hasGutter>
                  {sortGroupNames(allGroups).map((groupName) => {
                    const groupAll = allGroups[groupName];
                    const groupVisible = visibleByCategory[groupName] || [];

                    return (
                      <Stack key={groupName} hasGutter>
                        <div
                          className="agm-sticky-category-header"
                          style={{ top: `${filterHeight}px` }}
                        >
                          <Flex
                            spaceItems={{ default: "spaceItemsSm" }}
                            alignItems={{ default: "alignItemsBaseline" }}
                          >
                            <Title headingLevel="h3">{groupName}</Title>
                            <CategoryCounter
                              patterns={groupAll}
                              matchCount={groupVisible.length}
                              isFiltering={isFiltering}
                              formValues={formValues}
                            />
                          </Flex>
                        </div>
                        {groupVisible.length > 0 && (
                          <NestedContent>
                            <Stack hasGutter>
                              {groupVisible.map((pattern) => {
                                const isAutoSelected = selection[pattern.name] === SelectedBy.AUTO;
                                const isDirty = fieldMeta[pattern.name]?.isDirty ?? false;

                                return (
                                  <PatternCheckbox
                                    key={pattern.name}
                                    id={pattern.name}
                                    label={pattern.summary}
                                    description={pattern.description}
                                    isChecked={!!formValues[pattern.name]}
                                    onChange={(value) => form.setFieldValue(pattern.name, value)}
                                    extra={isAutoSelected && !isDirty && <AutoSelectedLabel />}
                                  />
                                );
                              })}
                            </Stack>
                          </NestedContent>
                        )}
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </form.Subscribe>

            <ActionGroup>
              <form.SubmitButton />
              <form.CancelButton />
            </ActionGroup>
          </Form>
        </form.AppForm>
      </Page.Content>
    </Page>
  );
}

export default SoftwarePatternsSelection;
