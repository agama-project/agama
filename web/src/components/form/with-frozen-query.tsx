/*
 * Copyright (c) [2026] SUSE LLC
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

import React, { useState } from "react";

/**
 * HOC that freezes initial query data and passes it as props to a memoized form
 * component.
 *
 * ## Problem
 *
 * When using TanStack Form with TanStack Query, query refetches change the data
 * reference, which can cause TanStack Form to reinitialize fields, producing
 * flickering and overwriting user edits mid-interaction.
 *
 * ## Solution
 *
 *  1. The wrapper calls the query hook and freezes the result on mount via
 *     `useState` lazy initializer (runs once).
 *  2. The inner form component is wrapped in `React.memo`, so it only re-renders
 *     when its props change.
 *  3. Because frozen props never change, the form never re-renders due to refetches.
 *
 * ## Architecture
 *
 * ```
 * withFrozenQuery(useHook, FormComponent)
 *   > FrozenQueryWrapper (subscribes to query, freezes data on mount)
 *     > MemoizedForm (receives frozen props, protected from refetches)
 *       > TanStack Form (stable defaultValues, no flickering)
 * ```
 *
 * ## Trade-offs
 *
 * - Form uses frozen initial data for `defaultValues` only.
 * - Write path should use `useUpdateConfig` (fetches fresh data at submit time).
 *
 * ## Usage
 *
 * ```tsx
 * type MyFormProps = {
 *   someValue: string;
 *   otherValue: number;
 * };
 *
 * function MyForm({ someValue, otherValue }: MyFormProps) {
 *   // form implementation
 * }
 *
 * // useMyQuery must return an object assignable to MyFormProps (or a subset of it)
 * export default withFrozenQuery(useMyQuery, MyForm);
 * ```
 *
 * @param useQueryHook - Hook that returns the data to freeze. Called at wrapper level.
 * @param Component    - Form component to memoize and receive frozen props.
 */
export function withFrozenQuery<TData extends object, TProps extends TData>(
  useQueryHook: () => TData,
  Component: React.ComponentType<TProps>,
): React.FC<Omit<TProps, keyof TData>> {
  // React.memo is applied to a concrete render function that closes over
  // Component, rather than to Component directly. This avoids the
  // MemoExoticComponent<ComponentType<TProps>> assignability error that occurs
  // when TProps contains unresolved generic constraints.
  const MemoizedInner = React.memo(function Inner(props: TProps) {
    return <Component {...props} />;
  });

  function FrozenQueryWrapper(outerProps: Omit<TProps, keyof TData>) {
    const data = useQueryHook();

    // Freeze on mount. useState lazy initializer runs only once.
    // Even when useQueryHook returns new data, frozenData stays the same.
    const [frozenData] = useState(() => data);

    // outerProps covers TProps minus TData; frozenData covers TData.
    // Together they satisfy TProps, but TypeScript cannot prove this from
    // the generic bounds alone, so we assert.
    const mergedProps = { ...outerProps, ...frozenData } as unknown as TProps;

    return <MemoizedInner {...mergedProps} />;
  }

  FrozenQueryWrapper.displayName = `withFrozenQuery(${Component.displayName ?? Component.name})`;

  return FrozenQueryWrapper;
}
