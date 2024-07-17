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

// @ts-check

/**
 * @typedef {new(...args: any[]) => T} GConstructor
 * @template {object} T
 */

/**
 * @typedef {GConstructor<{ client: import("./dbus").default }>} WithDBusClient
 */

/**
 * @typedef {GConstructor<{ client: import("./http").HTTPClient }>} WithHTTPClient
 */

/**
 * @typedef {GConstructor<{ client: import("./dbus").default, proxies: Object }>} WithDBusProxies
 */

/**
 * @typedef {[string, string, number, number]} DBusIssue
 */

/**
 * @typedef {object} StatusResource
 * @property {number} current - current status.
 */

/**
 * @typedef {object} Issue
 * @property {string} description
 * @property {string} details
 * @property {string} source - "unknown", "system" or "config"
 * @property {string} severity - "warn", "error"
 */

/**
 * @callback IssuesHandler
 * @param {Issue[]} issues
 * @return {void}
 */

const ISSUES_SOURCES = ["unknown", "system", "config"];

const buildIssue = ({ description, details, source, severity }) => {
  return {
    description,
    details,
    source: ISSUES_SOURCES[source],
    severity: severity === 0 ? "warn" : "error",
  };
};

/**
 * Extends the given class with methods to get and track the service status
 *
 * @template {!WithHTTPClient} T
 * @param {T} superclass - superclass to extend
 * @param {string} status_path - status resource path (e.g., "/manager/status").
 * @param {string} service_name - service name (e.g., "org.opensuse.Agama.Manager1").
 */
const WithStatus = (superclass, status_path, service_name) =>
  class extends superclass {
    /**
     * Returns the service status
     *
     * @return {Promise<number>} 0 for idle, 1 for busy
     */
    async getStatus() {
      const response = await this.client.get(status_path);
      if (!response.ok) {
        console.log("get status failed with:", response);
        return 1; // lets use busy to be on safe side
      } else {
        const status = await response.json();
        return status.current;
      }
    }

    /**
     * Register a callback to run when the "CurrentInstallationPhase" changes
     *
     * @param {function} handler - callback function
     * @return {import ("./http").RemoveFn} function to disable the callback
     */
    onStatusChange(handler) {
      return this.client.onEvent("ServiceStatusChanged", ({ status, service }) => {
        if (service === service_name) {
          handler(status);
        }
      });
    }
  };

/**
 * @typedef {object} Progress
 * @property {number} total - number of steps
 * @property {number} current - current step
 * @property {string} message - message of the current step
 * @property {boolean} finished - whether the progress already finished
 */

/**
 * @typedef {object} ProgressSequence
 * @property {string[]} steps - sequence steps if known in advance
 * @property {number} total - number of steps
 * @property {number} current - current step
 * @property {string} message - message of the current step
 * @property {boolean} finished - whether the progress already finished
 */

/**
 * @callback ProgressHandler
 * @param {Progress} progress - progress status
 * @return {void}
 */

/**
 * Extends the given class with methods to get and track the service progress
 *
 * @template {!WithHTTPClient} T
 * @param {T} superclass - superclass to extend
 * @param {string} progress_path - status resource path (e.g., "/manager/status").
 * @param {string} service_name - service name (e.g., "org.opensuse.Agama.Manager1").
 */
const WithProgress = (superclass, progress_path, service_name) =>
  class extends superclass {
    /**
     * Returns the service progress
     *
     * @return {Promise<ProgressSequence>} an object containing the total steps,
     *   the current step and whether the service finished or not.
     */
    async getProgress() {
      const response = await this.client.get(progress_path);
      if (!response.ok) {
        console.log("get progress failed with:", response);
        return {
          steps: [],
          total: 0,
          current: 0,
          message: "Failed to get progress",
          finished: false,
        };
      } else {
        const { steps, currentStep, maxSteps, currentTitle, finished } = await response.json();
        return {
          steps,
          total: maxSteps,
          current: currentStep,
          message: currentTitle,
          finished,
        };
      }
    }

    /**
     * Register a callback to run when the progress changes
     *
     * @param {ProgressHandler} handler - callback function
     * @return {import ("./http").RemoveFn} function to disable the callback
     */
    onProgressChange(handler) {
      return this.client.onEvent("Progress", ({ service, ...progress }) => {
        if (service === service_name) {
          const { currentStep, maxSteps, currentTitle, finished } = progress;
          handler({
            total: maxSteps,
            current: currentStep,
            message: currentTitle,
            finished,
          });
        }
      });
    }
  };

/**
 * @typedef {object} ValidationError
 * @property {string} message - Error message
 */

/**
 * @callback ValidationErrorsHandler
 * @param {ValidationError[]} errors - validation errors
 * @return {void}
 */

/**
 * @param {string} message - Error message
 */
const createError = (message) => {
  return { message };
};

export { WithProgress, WithStatus };
