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

const ISSUES_IFACE = "org.opensuse.Agama1.Issues";
const STATUS_IFACE = "org.opensuse.Agama1.ServiceStatus";
const PROGRESS_IFACE = "org.opensuse.Agama1.Progress";
const VALIDATION_IFACE = "org.opensuse.Agama1.Validation";

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

const ISSUES_SOURCES = [
  "unknown",
  "system",
  "config",
];

const buildIssue = ({ description, details, source, severity }) => {
  return {
    description,
    details,
    source: ISSUES_SOURCES[source],
    severity: severity === 0 ? "warn" : "error",
  };
};

/**
 * Extends the given class with methods to get the issues over D-Bus
 *
 * @template {!WithHTTPClient} T
 * @param {T} superclass - superclass to extend
 * @param {string} issues_path - validation resource path (e.g., "/manager/issues").
 * @param {string} dbus_path - service name (e.g., "/org/opensuse/Agama/Software1/product").
 */
const WithIssues = (superclass, issues_path, dbus_path) =>
  class extends superclass {
    /**
     * Returns the issues
     *
     * @return {Promise<Issue[]>}
     */
    async getIssues() {
      const issues = await this.client.get(issues_path);
      return issues.map(buildIssue);
    }

    /**
     * Gets all issues with error severity
     *
     * @return {Promise<Issue[]>}
     */
    async getErrors() {
      const issues = await this.getIssues();
      return issues.filter((i) => i.severity === "error");
    }

    /**
     * Registers a callback to run when the issues change
     *
     * @param {IssuesHandler} handler - callback function
     * @return {import ("./http").RemoveFn} function to disable the callback
     */
    onIssuesChange(handler) {
      return this.client.onEvent("IssuesChanged", ({ path, issues }) => {
        if (path === dbus_path) {
          handler(issues.map(buildIssue));
        }
      });
    }
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
      const status = await this.client.get(status_path);
      return status.current;
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
     * @return {Promise<Progress>} an object containing the total steps,
     *   the current step and whether the service finished or not.
     */
    async getProgress() {
      const { current_step, max_steps, current_title, finished } = await this.client.get(
        progress_path,
      );
      return {
        total: max_steps,
        current: current_step,
        message: current_title,
        finished,
      };
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
          const { current_step, max_steps, current_title, finished } = progress;
          handler({
            total: max_steps,
            current: current_step,
            message: current_title,
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
 *
 * @param {string} message - Error message
 */
const createError = (message) => {
  return { message };
};

/**
 * Extends the given class with methods to get validation errors over D-Bus
 * @param {string} object_path - object_path
 * @param {T} superclass - superclass to extend
 * @template {!WithDBusClient} T
 */
const WithValidation = (superclass, object_path) => class extends superclass {
  /**
   * Returns the validation errors
   *
   * @return {Promise<ValidationError[]>}
   */
  async getValidationErrors() {
    let errors;

    try {
      errors = await this.client.getProperty(object_path, VALIDATION_IFACE, "Errors");
    } catch (error) {
      console.error(`Could not get validation errors for ${object_path}`, error);
    }

    return errors.map(createError);
  }

  /**
   * Register a callback to run when the validation changes
   *
   * @param {ValidationErrorsHandler} handler - callback function
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onValidationChange(handler) {
    return this.client.onObjectChanged(object_path, VALIDATION_IFACE, () => {
      this.getValidationErrors().then(handler);
    });
  }
};

export { WithIssues, WithStatus, WithProgress, WithValidation };
