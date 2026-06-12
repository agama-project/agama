/**
 * This is just a dummy file to have translatable texts for implementing
 * an embedded terminal later. Delete this file when not needed anymore.
 */

import { _ } from "~/i18n";

/**
 * Dummy function just for defining translatable texts.
 * @returns Array of translated texts
 */
function dummy() {
  return [
    // TRANSLATORS: menu item for opening a terminal session in browser
    _("Terminal"),
    // TRANSLATORS: label for closing the terminal
    _("Close terminal"),
    // alternative message if we can only hide the terminal (keeping the current
    // session running)
    // TRANSLATORS: label for hiding the terminal
    _("Hide terminal"),
    // TRANSLATORS: error message
    _("Error: Cannot open a terminal session"),
    // TRANSLATORS: page header
    _("Terminal session"),
    // take the host name from document.location.host, display only when
    // connected remotely, i.e. the host is not "localhost"
    // TRANSLATORS:
    _("Connected to %s"),
    // TRANSLATORS: %s is keyboard shortcut for switching the browser tabs,
    // usually Ctrl+Tab
    _("Use %s keyboard shortcut to switch between the terminal and the installer."),
  ];
}

export default dummy;
