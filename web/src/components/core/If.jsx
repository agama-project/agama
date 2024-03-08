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

/**
 * Helper component for simplifying conditional interpolation in JSX blocks.
 * @component
 *
 * Borrowed from the old  Michael J. Ryan’s comment at https://github.com/facebook/jsx/issues/65#issuecomment-255484351
 * See more options at https://blog.logrocket.com/react-conditional-rendering-9-methods/
 *
 * Please, use it only when "conditionally interpolating" content in a
 * "JSX block". For rendering a content or null it's better to go for an early
 * return.
 *
 * @example <caption>Using an early return instead</caption>
 *   ...
 *   if (loaded) return <Ready />
 *
 *   return (
 *     <Card>
 *       <Title>Loading data</Title>
 *       <Body>
 *         <LoadingProgress />
 *       </Body>
 *     </Card>
 *   );
 *   ...
 *
 * @example <caption>Using `<If>` in a JSX block</caption>
 *   ...
 *   return (
 *     <Card>
 *       <Title>Loading data</Title>
 *       <Body>
 *         <If condition={loading} then={<Spinner />} />
 *         <If condition={loadingStorage} then={<LoadingStorageData />} else={<StorageLoaded />} />
 *         <If condition={loadingNetwork} then={<LoadingNetwork />} else={<NetworkLoaded />} />
 *       </Body>
 *     </Card>
 *   );
 *   ...
 *
 * @param {object} props
 * @param {truthy} props.condition
 * @param {JSX.Element} [props.then=null] - the content to be rendered when the condition is true
 * @param {JSX.Element} [props.else=null] - the content to be rendered when the condition is false
 */
export default function If ({
  condition,
  then: positive = null,
  else: negative = null
}) {
  return condition ? positive : negative;
}
