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
 * @typedef {GConstructor<{ client: import("./dbus").default, proxies: Object }>} WithDBusProxies
 */

/**
 * @typedef {[string, string, number, number]} DBusIssue
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

/**
 * Builds an issue from a D-Bus issue
 *
 * @param {DBusIssue} dbusIssue
 * @return {Issue}
 */
const buildIssue = (dbusIssue) => {
  const source = (value) => {
    switch (value) {
      case 0: return "unknown";
      case 1: return "system";
      case 2: return "config";
    }
  };

  const severity = (value) => {
    return value === 0 ? "warn" : "error";
  };

  return {
    description: dbusIssue[0],
    details: dbusIssue[1],
    source: source(dbusIssue[2]),
    severity: severity(dbusIssue[3])
  };
};

/**
 * Extends the given class with methods to get the issues over D-Bus
 * @param {string} object_path - object_path
 * @param {T} superclass - superclass to extend
 * @template {!WithDBusProxies} T
 */
const WithIssues = (superclass, object_path) => class extends superclass {
  constructor(...args) {
    super(...args);
    this.proxies.issues = this.client.proxy(ISSUES_IFACE, object_path);
  }

  /**
   * Returns the issues
   *
   * @return {Promise<Issue[]>}
   */
  async getIssues() {
    const proxy = await this.proxies.issues;
    return proxy.All.map(buildIssue);
  }

  /**
   * Gets all issues with error severity
   *
   * @return {Promise<Issue[]>}
   */
  async getErrors() {
    const issues = await this.getIssues();
    return issues.filter(i => i.severity === "error");
  }

  /**
   * Registers a callback to run when the issues change
   *
   * @param {IssuesHandler} handler - callback function
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onIssuesChange(handler) {
    return this.client.onObjectChanged(object_path, ISSUES_IFACE, (changes) => {
      if ("All" in changes) {
        const dbusIssues = changes.All.v;
        const issues = dbusIssues.map(buildIssue);
        handler(issues);
      }
    });
  }
};

/**
 * Extends the given class with methods to get and track the progress over D-Bus
 *
 * @template {!WithDBusClient} T
 * @param {string} object_path - object path
 * @param {T} superclass - superclass to extend
 */
const WithStatus = (superclass, object_path) => class extends superclass {
  /**
   * Returns the service status
   *
   * @return {Promise<number>} 0 for idle, 1 for busy
   */
  async getStatus() {
    const proxy = await this.client.proxy(STATUS_IFACE, object_path);
    return proxy.Current;
  }

  /**
   * Register a callback to run when the "CurrentInstallationPhase" changes
   *
   * @param {function} handler - callback function
   * @return {function} function to disable the callback
   */
  onStatusChange(handler) {
    return this.client.onObjectChanged(object_path, STATUS_IFACE, (changes) => {
      if ("Current" in changes) {
        handler(changes.Current.v);
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
 * Extends the given class with methods to get and track the progress over D-Bus
 * @param {string} object_path - object_path
 * @param {T} superclass - superclass to extend
 * @template {!WithDBusClient} T
 */
const WithProgress = (superclass, object_path) => class extends superclass {
  /**
   * Returns the service progress
   *
   * @return {Promise<Progress>} an object containing the total steps,
   *   the current step and whether the service finished or not.
   */
  async getProgress() {
    const proxy = await this.client.proxy(PROGRESS_IFACE, object_path);
    return {
      total: proxy.TotalSteps,
      current: proxy.CurrentStep[0],
      message: proxy.CurrentStep[1],
      finished: proxy.Finished
    };
  }

  /**
   * Register a callback to run when the progress changes
   *
   * @param {ProgressHandler} handler - callback function
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onProgressChange(handler) {
    return this.client.onObjectChanged(object_path, PROGRESS_IFACE, (changes) => {
      const { TotalSteps, CurrentStep, Finished } = changes;
      if (TotalSteps === undefined && CurrentStep === undefined && Finished === undefined) {
        return;
      }

      this.getProgress().then(handler);
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
