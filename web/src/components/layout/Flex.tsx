/*
 * Copyright (c) [2024] SUSE LLC
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

import React from "react";
import { Flex as PFFlex, FlexProps, FlexItem, FlexItemProps } from "@patternfly/react-core";

/**
 * NOTE: below code for dealing with PF/Flex types and extract the "responsive props" is a bit
 * complex but useful for building a wrapper around such a component without the risk of getting it
 * silently broken if PF/Flex changes these props by deleting them or adding new ones.
 *
 * For sure, would be better to add these responsive props shortcuts direclty in PF/Flex to allow
 * the consumer to just set the `default` value when not needed to change it depending on
 * the breakpoint. But at this moment we're a bit short of time for creating and testing such
 * an elaborated PR against upstream.
 *
 * BTW, the lines for extracting an object from the type were borrowed from
 * https://dev.to/scooperdev/generate-array-of-all-an-interfaces-keys-with-typescript-4hbf
 */

// NOTE: PF/Flex#order prop is missing "sm" breakpoint
// NOTE: The omitted props match the extends constraint because they are typed
// as "any", see https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/react/index.d.ts#L2923-L3001
// (FlexProps interface extends React.HTMLProps)
type ResponsiveFlexProps = {
  [Key in keyof Omit<FlexProps, "download" | "inlist"> as FlexProps[Key] extends {
    default?: unknown;
  }
    ? Key
    : // @ts-ignore
      never]: FlexProps[Key]["default"] | FlexProps[Key];
};
type ResponsiveProps = Record<keyof ResponsiveFlexProps, undefined>;

// Creates an object based on the type for being able to have the keys at runtime
// @see #mappedProps to check its usage.
const responsiveProps: ResponsiveProps = {
  gap: undefined,
  grow: undefined,
  spacer: undefined,
  spaceItems: undefined,
  rowGap: undefined,
  columnGap: undefined,
  flex: undefined,
  direction: undefined,
  alignItems: undefined,
  alignContent: undefined,
  alignSelf: undefined,
  align: undefined,
  justifyContent: undefined,
  display: undefined,
  fullWidth: undefined,
  flexWrap: undefined,
  order: undefined,
  shrink: undefined,
};

const RESPONSIVE_FLEX_PROPS = Object.keys(responsiveProps);

type ResponsiveFlexItemProps = {
  [Key in keyof Omit<FlexItemProps, "download" | "inlist"> as FlexItemProps[Key] extends {
    default?: unknown;
  }
    ? Key
    : // @ts-ignore
      never]: FlexItemProps[Key]["default"] | FlexItemProps[Key];
};
type ResponsiveItemProps = Record<keyof ResponsiveFlexItemProps, undefined>;

// Creates an object based on the type for being able to have the keys at runtime
// @see #mappedProps to check its usage.
const responsiveItemProps: ResponsiveItemProps = {
  spacer: undefined,
  grow: undefined,
  shrink: undefined,
  flex: undefined,
  alignSelf: undefined,
  align: undefined,
  fullWidth: undefined,
  order: undefined,
};

const RESPONSIVE_FLEX_ITEM_PROPS = Object.keys(responsiveItemProps);

type AgamaFlexProps = FlexProps | ResponsiveFlexProps;
type AgamaFlexItemProps = FlexItemProps | ResponsiveFlexItemProps;

/**
 * Helper function for mapping found responsive props from `value` to `{ default: value }`
 *
 * @param props - collection of prop to be mapped
 * @param responsivePropsKeys - keys of props that must be considered as responsive prop
 */
const mappedProps = (
  props: AgamaFlexProps | AgamaFlexItemProps,
  responsiveProps: string[],
): FlexProps | FlexItemProps =>
  Object.keys(props).reduce((result, k) => {
    const value = props[k];
    const needsMapping = responsiveProps.includes(k) && typeof value === "string";
    result[k] = needsMapping ? { default: value } : value;
    return result;
  }, {});

/**
 * Wrapper around PatternFly/FlexItem that allows giving plain value to responsive props instead
 * of an object when only interested in the value for the `default` key. I.e., it allows typing
 * `grow="grow"` instead of `grow={{ default: "grow" }}`
 *
 * To know more see {@link https://www.patternfly.org/layouts/flex#flexitem | PF/FlexItem}
 */
const Item = (props: AgamaFlexItemProps) => (
  <FlexItem {...mappedProps(props, RESPONSIVE_FLEX_ITEM_PROPS)} />
);

/**
 * Wrapper around PatternFly/Flex that allows giving plain value to responsive props instead of an
 * object when only interested in the value for the `default` key. I.e., it allows typing
 * `columnGap="columnGapLg"` instead of `columnGap={{ default: "columnGapLg" }}`
 *
 * Additionally, it sets `alignItems={{ default: "alignItemsCenter" }}` by default.
 *
 * To know more see {@link https://www.patternfly.org/layouts/flex | PF/Flex}
 */
const Flex = (props: AgamaFlexProps): React.ReactNode => {
  return (
    <PFFlex
      alignItems={{ default: "alignItemsCenter" }}
      {...mappedProps(props, RESPONSIVE_FLEX_PROPS)}
    />
  );
};

Flex.Item = Item;
export default Flex;
