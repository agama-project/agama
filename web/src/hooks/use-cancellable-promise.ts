/*
 * Copyright (c) [2022-2025] SUSE LLC
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

import { useEffect, useRef, useCallback } from "react";

type CancellableWrapper<T> = {
  /** Cancellable promise */
  promise: Promise<T>;
  /** Function for cancelling the promise */
  cancel: Function;
};

/**
 * Creates a wrapper object with a cancellable promise and a function for canceling the promise
 *
 * @see useCancellablePromise
 */
const makeCancellable = <T>(promise: Promise<T>): CancellableWrapper<T> => {
  let isCanceled = false;

  const cancellablePromise: Promise<T> = new Promise((resolve, reject) => {
    promise
      .then((value) => !isCanceled && resolve(value))
      .catch((error) => !isCanceled && reject(error));
  });

  return {
    promise: cancellablePromise,
    cancel() {
      isCanceled = true;
    },
  };
};

/**
 * Allows using promises in a safer way.
 *
 * This hook is useful for safely performing actions that modify a React
 * component after resolving a promise. Note that nothing guarantees that a
 * React component is still mounted when a promise is resolved.
 *
 * @see {@link https://overreacted.io/a-complete-guide-to-useeffect/#speaking-of-race-conditions|Race conditions}
 *
 * The hook provides a function for making promises cancellable. All cancellable promises are
 * automatically canceled once the component is unmounted. Note that the promises are not really
 * canceled. In this context, a canceled promise means that the promise will be neither resolved nor
 * rejected. Canceled promises will be destroyed by the garbage collector after unmounting the
 * component.
 *
 * @see {@link https://rajeshnaroth.medium.com/writing-a-react-hook-to-cancel-promises-when-a-component-unmounts-526efabf251f|Cancel promises}
 *
 * @example
 *
 * const { cancellablePromise } = useCancellablePromise();
 * const [state, setState] = useState();
 *
 * useEffect(() => {
 *  const promise = new Promise((resolve) => setTimeout(() => resolve("success"), 6000));
 * // The state is only set if the promise is not canceled
 *  cancellablePromise(promise).then(setState);
 * }, [setState, cancellablePromise]);
 */
export const useCancellablePromise = <T>() => {
  const promises = useRef<Array<CancellableWrapper<T>>>();

  useEffect(() => {
    promises.current = [];

    return () => {
      promises.current.forEach((p) => p.cancel());
      promises.current = [];
    };
  }, []);

  const cancellablePromise = useCallback((promise: Promise<T>): Promise<T> => {
    const cancellableWrapper: CancellableWrapper<T> = makeCancellable(promise);
    promises.current.push(cancellableWrapper);
    return cancellableWrapper.promise;
  }, []);

  return { cancellablePromise };
};
