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

import { useEffect } from "react";

/**
 * Returns a new array with a given collection split into two groups, the first holding elements
 * satisfying the filter and the second with those which do not.
 *
 * @param {Array} collection - the collection to be filtered
 * @param {function} filter - the function to be used as filter
 * @return {Array[]} a pair of arrays, [passing, failing]
 */
const partition = (collection, filter) => {
  const pass = [];
  const fail = [];

  collection.forEach(element => {
    filter(element) ? pass.push(element) : fail.push(element);
  });

  return [pass, fail];
};

/**
 * Allows using the React useEffect hook in a safer way.
 *
 * This effect is useful for performing actions that modify a React component after resolving a
 * promise (e.g., setting the component state once a D-Bus call is answered). Note that nothing
 * guarantees that a React component is still mounted when a promise is resolved.
 *
 *  @see {@link https://overreacted.io/a-complete-guide-to-useeffect/#speaking-of-race-conditions|Race conditions}
 *
 * This effect receives a callback function as argument. That callback will be invoked passing a
 * function argument which can be used inside the callback code in order to run unsafe actions in a
 * safe way.
 *
 * The callback is the only one dependency of this effect. Make sure the callback object does not
 * change to avoid firing the effect after every completed render. It is recommended to wrap your
 * callback function with a useCallback hook.
 *
 * The callback passed to useSafeEffect can return a clean-up function.
 *
 * @example
 *
 * const [state, setState] = useState();
 *
 * useEffect(() => {
 *  const promise = new Promise((resolve) => setTimeout(() => resolve("success"), 6000));
 *  promise.then(setState); // This could fail if the component is unmounted
 * }, [setState]);
 *
 * useSafeEffect(useCallback((makeSafe) => {
 *  const promise = new Promise((resolve) => setTimeout(() => resolve("success"), 6000));
 *  promise.then(makeSafe(setState));  // The state is only set if the component is still mounted
 * }, [setState]));
 *
 * @param {function} callback
 */
function useSafeEffect(callback) {
  useEffect(() => {
    let mounted = true;

    const makeSafe = (unsafeFn) => {
      return (...args) => {
        if (mounted) unsafeFn(...args);
      };
    };

    const result = callback(makeSafe);

    return () => {
      mounted = false;
      if (result) result();
    };
  }, [callback]);
}

export {
  partition,
  useSafeEffect
};
