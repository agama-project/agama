/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Returns true when given value is an
 * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object Object}
 *
 * Borrowed from https://dev.to/alesm0101/how-to-check-if-a-value-is-an-object-in-javascript-3pin
 *
 * @param {any} value - the value to be checked
 * @return {boolean} true when given value is an object; false otherwise
 */
const isObject = (value) => (
  typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof RegExp) &&
    !(value instanceof Date) &&
    !(value instanceof Set) &&
    !(value instanceof Map)
);

/**
 * Returns an empty function useful to be used as a default callback.
 *
 * @return {function} empty function
 */
const noop = () => undefined;

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
 * Simple utility function to help building className conditionally
 *
 * @example
 * // returns "bg-yellow w-24"
 * classNames("bg-yellow", true && "w-24", false && "h-24");
 *
 * @todo Use https://github.com/JedWatson/classnames instead?
 *
 * @param {...*} CSS classes to join
 * @returns {String} CSS classes joined together after ignoring falsy values
 */
function classNames(...classes) {
  return classes.filter((item) => !!item).join(' ');
}

/**
 * @typedef {Object} cancellableWrapper
 * @property {Promise} promise - Cancellable promise
 * @property {function} cancel - Function for canceling the promise
 */

/**
 * Creates a wrapper object with a cancellable promise and a function for canceling the promise
 *
 * @see useCancellablePromise
 *
 * @param {Promise} promise
 * @returns {cancellableWrapper}
 */
function makeCancellable(promise) {
  let isCanceled = false;

  const cancellablePromise = new Promise((resolve, reject) => {
    promise
      .then((value) => (!isCanceled && resolve(value)))
      .catch((error) => (!isCanceled && reject(error)));
  });

  return {
    promise: cancellablePromise,
    cancel() {
      isCanceled = true;
    }
  };
}

/**
 * Allows using promises in a safer way.
 *
 * This hook is useful for safely performing actions that modify a React component after resolving
 * a promise (e.g., setting the component state once a D-Bus call is answered). Note that nothing
 * guarantees that a React component is still mounted when a promise is resolved.
 *
 *  @see {@link https://overreacted.io/a-complete-guide-to-useeffect/#speaking-of-race-conditions|Race conditions}
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
function useCancellablePromise() {
  const promises = useRef();

  useEffect(() => {
    promises.current = [];

    return () => {
      promises.current.forEach(p => p.cancel());
      promises.current = [];
    };
  }, []);

  const cancellablePromise = useCallback((promise) => {
    const cancellableWrapper = makeCancellable(promise);
    promises.current.push(cancellableWrapper);
    return cancellableWrapper.promise;
  }, []);

  return { cancellablePromise };
}

/** Hook for using local storage
 *
 * @see {@link https://www.robinwieruch.de/react-uselocalstorage-hook/}
 *
 * @param {String} storageKey
 * @param {*} fallbackState
 */
const useLocalStorage = (storageKey, fallbackState) => {
  const [value, setValue] = useState(
    JSON.parse(localStorage.getItem(storageKey)) ?? fallbackState
  );

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [value, storageKey]);

  return [value, setValue];
};

/**
 * Debounce hook.
 * @function
 *
 * Source {@link https://designtechworld.medium.com/create-a-custom-debounce-hook-in-react-114f3f245260}
 *
 * @param {function} callback - Function to be called after some delay.
 * @param {number} delay - Delay in milliseconds.
 * @returns {function}
 *
 * @example
 *
 * const log = useDebounce(console.log, 1000);
 * log("test ", 1) // The message will be logged after at least 1 second.
 * log("test ", 2) // Subsequent calls cancels pending calls.
 */
const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Cleanup the previous timeout on re-render
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = (...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  };

  return debouncedCallback;
};

const hex = (value) => {
  const sanitizedValue = value.replaceAll(".", "");
  return parseInt(sanitizedValue, 16);
};

/**
 * Converts an issue to a validation error
 * @function
 *
 * @todo This conversion will not be needed after adapting Section to directly work with issues.
 *
 * @param {import("~/client/mixins").Issue} issues
 * @returns {import("~/client/mixins").ValidationError}
 */
const toValidationError = (issue) => ({ message: issue.description });

/**
 * Wrapper around window.location.reload
 * @function
 *
 * It's needed mainly to ease testing because we can't override window in jest with jsdom anymore
 *
 * See below links
 *   - https://github.com/jsdom/jsdom/blob/master/Changelog.md#2100
 *   - https://github.com/jsdom/jsdom/issues/3492
 */
const locationReload = () => {
  window.location.reload();
};

/**
 * Wrapper around window.location.search setter
 * @function
 *
 * It's needed mainly to ease testing as we can't override window in jest with jsdom anymore
 *
 * See below links
 *   - https://github.com/jsdom/jsdom/blob/master/Changelog.md#2100
 *   - https://github.com/jsdom/jsdom/issues/3492
 *
 * @param {string} query
 */
const setLocationSearch = (query) => {
  window.location.search = query;
};

/**
 * Is the Agama server running locally?
 *
 * This function should be used only in special cases, the Agama behavior should
 * be the same regardless of the user connection.
 *
 * The local connection can be forced by setting the `LOCAL_CONNECTION`
 * environment variable to `1`. This can be useful for debugging or for
 * development.
 *
 * @returns {boolean} `true` if the connection is local, `false` otherwise
 */
const localConnection = (location = window.location) => {
  // forced local behavior
  if (process.env.LOCAL_CONNECTION === "1") return true;

  // when running in a development server use the COCKPIT_TARGET_URL value
  // (a proxy is used) otherwise use the page URL from the browser
  const hostname = process.env.WEBPACK_SERVE ? (new URL(COCKPIT_TARGET_URL)).hostname : location.hostname;

  // using the loopback device? (hostname or IP address)
  return hostname === "localhost" || hostname.startsWith("127.");
};

/**
 * Is the Agama server running remotely?
 *
 * @see localConnection
 *
 * @returns {boolean} `true` if the connection is remote, `false` otherwise
 */
const remoteConnection = (...args) => !localConnection(...args);

/**
 * Time for the given timezone.
 *
 * @param {string} timezone - E.g., "Atlantic/Canary".
 * @param {object} [options]
 * @param {Date} options.date - Date to take the time from.
 *
 * @returns {string|undefined} - Time in 24 hours format (e.g., "23:56"). Undefined for an unknown
 *  timezone.
 */
const timezoneTime = (timezone, { date = new Date() }) => {
  try {
    const formatter = new Intl.DateTimeFormat(
      "en-US",
      { timeZone: timezone, timeStyle: "short", hour12: false }
    );

    return formatter.format(date);
  } catch (e) {
    if (e instanceof RangeError) return undefined;

    throw e;
  }
};

/**
 * UTC offset for the given timezone.
 *
 * @param {string} timezone - E.g., "Atlantic/Canary".
 * @returns {number|undefined} - undefined for an unknown timezone.
 */
const timezoneUTCOffset = (timezone) => {
  try {
    const date = new Date();
    const dateLocaleString = date.toLocaleString(
      "en-US",
      { timeZone: timezone, timeZoneName: "short" }
    );
    const [timezoneName] = dateLocaleString.split(' ').slice(-1);
    const dateString = date.toString();
    const offset = Date.parse(`${dateString} UTC`) - Date.parse(`${dateString} ${timezoneName}`);

    return offset / 3600000;
  } catch (e) {
    if (e instanceof RangeError) return undefined;

    throw e;
  }
};

/**
* Path to data within an object. It can contain dots for indicating nested keys.
* @typedef {string} ObjectPath
*/

export {
  noop,
  isObject,
  partition,
  classNames,
  useCancellablePromise,
  useLocalStorage,
  useDebounce,
  hex,
  toValidationError,
  locationReload,
  setLocationSearch,
  localConnection,
  remoteConnection,
  timezoneTime,
  timezoneUTCOffset
};
