# ***************************************************************************
#
# Copyright (c) 2002 - 2012 Novell, Inc.
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of version 2 of the GNU General Public License as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, contact Novell, Inc.
#
# To contact Novell about this file by physical or electronic mail,
# you may find current contact information at www.novell.com
#
# ***************************************************************************
# File:  modules/Report.ycp
# Package:  yast2
# Summary:  Messages handling
# Authors:  Ladislav Slezak <lslezak@suse.cz>
# Flags:  Stable
#
# $Id$
#
#
require "yast"
require "yast2/popup"

module Yast
  # Report module is universal reporting module. It properly display messages
  # in CLI, TUI, GUI or even in automatic installation. It also collects
  # warnings and errors. Collected messages can be displayed later.
  # @TODO not all methods respect all environment, feel free to open issue with
  #   method that doesn't respect it.
  # Disable unused method check as we cannot rename keyword parameter for backward compatibility
  # rubocop:disable Lint/UnusedMethodArgument
  class ReportClass < Module
    include Yast::Logger

    def main
      textdomain "base"

      Yast.import "Mode"
      Yast.import "Summary"

      # stored messages
      @errors = []
      @warnings = []
      @messages = []
      @yesno_messages = []

      # display flags
      @display_errors = true
      @display_warnings = true
      @display_messages = true
      @display_yesno_messages = true

      # timeouts
      # AutoYaST has different timeout (bnc#887397)
      @default_timeout = (Mode.auto || Mode.config) ? 10 : 0
      @timeout_errors = 0 # default: Errors stop the installation
      @timeout_warnings = @default_timeout
      @timeout_messages = @default_timeout
      @timeout_yesno_messages = @default_timeout

      # logging flags
      @log_errors = true
      @log_warnings = true
      @log_messages = true
      @log_yesno_messages = true

      @message_settings = {}
      @error_settings = {}
      @warning_settings = {}
      @yesno_message_settings = {}

      # default value of settings modified
      @modified = false
    end

    # Summary of current settings
    # @return Html formatted configuration summary
    def Summary
      summary = ""
      # translators: summary header for messages generated through autoinstallation
      summary = Summary.AddHeader(summary, _("Messages"))
      summary = Summary.OpenList(summary)

      # Report configuration - will be normal messages displayed?
      # '%1' will be replaced by translated string "Yes" or "No"
      summary = Summary.AddListItem(
        summary,
        Builtins.sformat(
          _("Display Messages: %1"),
          # translators: summary if the messages should be displayed
          @display_messages ? _("Yes") : _("No")
        )
      )
      # Report configuration - will have normal messages timeout?
      # '%1' will be replaced by number of seconds
      summary = Summary.AddListItem(
        summary,
        Builtins.sformat(_("Time-out Messages: %1"), @timeout_messages)
      )
      # Report configuration - will be normal messages logged to file?
      # '%1' will be replaced by translated string "Yes" or "No"
      summary = Summary.AddListItem(
        summary,
        Builtins.sformat(
          _("Log Messages: %1"),
          # translators: summary if the messages should be written to log file
          @log_messages ? _("Yes") : _("No")
        )
      )
      summary = Summary.CloseList(summary)
      # translators: summary header for warnings generated through autoinstallation
      summary = Summary.AddHeader(summary, _("Warnings"))
      summary = Summary.OpenList(summary)
      # Report configuration - will be warning messages displayed?
      # '%1' will be replaced by translated string "Yes" or "No"
      summary = Summary.AddListItem(
        summary,
        Builtins.sformat(
          _("Display Warnings: %1"),
          # translators: summary if the warnings should be displayed
          @display_warnings ? _("Yes") : _("No")
        )
      )
      # Report configuration - will have warning messages timeout?
      # '%1' will be replaced by number of seconds
      summary = Summary.AddListItem(
        summary,
        Builtins.sformat(_("Time-out Warnings: %1"), @timeout_warnings)
      )
      # Report configuration - will be warning messages logged to file?
      # '%1' will be replaced by translated string "Yes" or "No"
      summary = Summary.AddListItem(
        summary,
        Builtins.sformat(
          _("Log Warnings: %1"),
          # translators: summary if the warnings should be written to log file
          @log_warnings ? _("Yes") : _("No")
        )
      )
      summary = Summary.CloseList(summary)
      # translators: summary header for errors generated through autoinstallation
      summary = Summary.AddHeader(summary, _("Errors"))
      summary = Summary.OpenList(summary)
      # Report configuration - will be error messages displayed?
      # '%1' will be replaced by translated string "Yes" or "No"
      summary = Summary.AddListItem(
        summary,
        Builtins.sformat(
          _("Display Errors: %1"),
          # translators: summary if the errors should be displayed
          @display_errors ? _("Yes") : _("No")
        )
      )
      # Report configuration - will have error messages timeout?
      # '%1' will be replaced by number of seconds
      summary = Summary.AddListItem(
        summary,
        Builtins.sformat(_("Time-out Errors: %1"), @timeout_errors)
      )
      # Report configuration - will be error messages logged to file?
      # '%1' will be replaced by translated string "Yes" or "No"
      summary = Summary.AddListItem(
        summary,
        Builtins.sformat(
          _("Log Errors: %1"),
          # translators: summary if the errors should be written to log file
          @log_errors ? _("Yes") : _("No")
        )
      )
      Summary.CloseList(summary)
      # summary = Summary::AddHeader(summary, _("Yes or No Messages (Critical Messages)"));
      # summary = Summary::OpenList(summary);
      # // Report configuration - will be error messages displayed?
      # // '%1' will be replaced by translated string "Yes" or "No"
      # summary = Summary::AddListItem(summary, sformat(_("Display Yes or No Messages: %1"), (display_yesno_messages) ?
      #                 _("Yes") : _("No")));
      # // Report configuration - will have error messages timeout?
      # // '%1' will be replaced by number of seconds
      # summary = Summary::AddListItem(summary, sformat(_("Time-out Yes or No Messages: %1"), timeout_yesno_messages));
      # // Report configuration - will be error messages logged to file?
      # // '%1' will be replaced by translated string "Yes" or "No"
      # summary = Summary::AddListItem(summary, sformat(_("Log Yes or No Messages: %1"), (log_yesno_messages) ?
      #                 _("Yes") : _("No")));
      # summary = Summary::CloseList(summary);
    end

    # Dump the Report settings to a map, for autoinstallation use.
    # @return [Hash] Map with settings
    def Export
      {
        "messages"       => {
          "log"     => @log_messages,
          "timeout" => @timeout_messages,
          "show"    => @display_messages
        },
        "errors"         => {
          "log"     => @log_errors,
          "timeout" => @timeout_errors,
          "show"    => @display_errors
        },
        "warnings"       => {
          "log"     => @log_warnings,
          "timeout" => @timeout_warnings,
          "show"    => @display_warnings
        },
        "yesno_messages" => {
          "log"     => @log_yesno_messages,
          "timeout" => @timeout_yesno_messages,
          "show"    => @display_yesno_messages
        }
      }
    end

    BACKWARD_MAPPING = {
      focus_yes: :yes,
      focus_no:  :no
    }.freeze

    # Question with headline and Yes/No Buttons
    # @param [String] headline Popup Headline
    # @param [String] message Popup Message
    # @param [String] yes_button_message Yes Button Message
    # @param [String] no_button_message No Button Message
    # @param [Symbol] focus Which Button has the focus. Possible values are `:yes` and :no`.
    #   For backward compatibility also `:focus_yes` and `:focus_no` is accepted.
    # @return [Boolean] True if Yes is pressed, otherwise false
    def AnyQuestion(headline, message, yes_button_message, no_button_message, focus)
      Builtins.y2milestone(1, "%1", message) if @log_yesno_messages

      focus = BACKWARD_MAPPING[focus] || focus
      ret = false
      if @display_yesno_messages
        timeout = (@timeout_yesno_messages.to_s.to_i > 0) ? @timeout_yesno_messages : 0
        ret = Yast2::Popup.show(message, headline: headline,
          buttons: { yes: yes_button_message, no: no_button_message },
          focus: focus, timeout: timeout)
      end

      @yesno_messages = Builtins.add(@yesno_messages, message)
      ret == :yes
    end

    # Question presented via the Yast2::Popup class
    #
    # It works like any other method used to present yesno_messages, but it
    # delegates drawing the pop-up to {Yast2::Popup.show}, in case the message
    # must be presented to the user (which can be configured via
    # {#DisplayYesNoMessages}).
    #
    # All the arguments are forwarded to #{Yast2::Popup.show} almost as-is, but
    # some aspects must be observed:
    #
    #   - The argument :timeout will be ignored, the timeout fixed in the Report
    #   module will always be used instead (again, see {#DisplayYesNoMessages}).
    #   - The button ids must be :yes and :no, to honor the Report API.
    #   - Due to the previous point, if no :buttons argument is provided, the
    #   value :yes_no will be used for it.
    #
    # Like any other method used to present yesno_messages, false is always
    # returned if the system is configured to not display messages, no matter
    # what was selected as the focused default answer.
    #
    # @param [String] message Popup message, forwarded to {Yast2::Popup.show}
    # @param [Hash] extra_args Extra options to be forwarded to {Yast2::Popup.show},
    #   see description for some considerations
    # @return [Boolean] True if :yes is pressed, otherwise false
    def yesno_popup(message, extra_args = {})
      # Use exactly the same y2milestone call than other yesno methods
      Builtins.y2milestone(1, "%1", message) if @log_yesno_messages

      log.warn "Report.yesno_popup will ignore the :timeout argument" if extra_args.key?(:timeout)

      ret =
        if @display_yesno_messages
          args = { buttons: :yes_no }.merge(extra_args)
          args[:timeout] = @timeout_yesno_messages
          answer = Yast2::Popup.show(message, **args)
          answer == :yes
        else
          false
        end

      @yesno_messages << message
      ret
    end

    # Store new message text
    # @param [String] message_string message text, it can contain new line characters ("\n")
    # @return [void]
    def Message(message_string)
      Builtins.y2milestone(1, "%1", message_string) if @log_messages

      if @display_messages
        timeout = (@timeout_messages.to_s.to_i > 0) ? @timeout_messages : 0
        Yast2::Popup.show(message_string, timeout: timeout)
      end

      @messages = Builtins.add(@messages, message_string)

      nil
    end

    # Store new message text, the text is displayed in a richtext widget - long lines are automatically wrapped
    # @param [String] message_string message text (it can contain rich text tags)
    # @param width [Integer] width of popup (@see Popup#LongMessageGeometry)
    # @param height [Integer] height of popup (@see Popup#LongMessageGeometry)
    # @return [void]
    def LongMessage(message_string, width: 60, height: 10)
      Builtins.y2milestone(1, "%1", message_string) if @log_messages

      if @display_messages
        timeout = (@timeout_messages.to_s.to_i > 0) ? @timeout_messages : 0
        Yast2::Popup.show(message_string, richtext: true, timeout: timeout)
      end

      @messages = Builtins.add(@messages, message_string)

      nil
    end

    # Store new warning text
    # @param [String] warning_string warning text, it can contain new line characters ("\n")
    # @return [void]
    def Warning(warning_string)
      Builtins.y2warning(1, "%1", warning_string) if @log_warnings

      if @display_warnings
        timeout = (@timeout_warnings.to_s.to_i > 0) ? @timeout_warnings : 0
        Yast2::Popup.show(warning_string, headline: :warning, timeout: timeout)
      end

      @warnings = Builtins.add(@warnings, warning_string)

      nil
    end

    # Display and record error string.
    #
    # @note Displaying can be globally disabled using Display* methods.
    # @param [String] error_string error text, it can contain new line characters ("\n")
    # @return [nil]
    def Error(error_string)
      Builtins.y2error(1, "%1", error_string) if @log_errors

      if @display_errors
        timeout = (@timeout_errors.to_s.to_i > 0) ? @timeout_errors : 0
        Yast2::Popup.show(error_string, headline: :error, timeout: timeout)
      end

      @errors = Builtins.add(@errors, error_string)

      nil
    end

    # Message popup dialog can be displayed immediately when a new message  is stored.
    #
    # This function enables or diables popuping of dialogs.
    #
    # @param [Boolean] display if true then display message popups immediately
    # @param [Fixnum] timeout dialog is automatically closed after timeout seconds. Value 0 means no time out, dialog will be closed only by user.
    # @return [void]

    # Yes/No Message popup dialog can be displayed immediately when a new message  is stored.
    #
    # This function enables or diables popuping of dialogs.
    #
    # @param [Boolean] display if true then display message popups immediately
    # @param [Fixnum] timeout dialog is automatically closed after timeout seconds. Value 0 means no time out, dialog will be closed only by user.
    # @return [void]

    def DisplayYesNoMessages(display, timeout)
      @display_yesno_messages = display
      @timeout_yesno_messages = timeout
      nil
    end
    # rubocop:enable Lint/UnusedMethodArgument

    publish variable: :message_settings, type: "map"
    publish variable: :error_settings, type: "map"
    publish variable: :warning_settings, type: "map"
    publish variable: :yesno_message_settings, type: "map"
    publish variable: :modified, type: "boolean"
    publish function: :Summary, type: "string ()"
    publish function: :Export, type: "map ()"
    publish function: :AnyQuestion, type: "boolean (string, string, string, string, symbol)"
    publish function: :Message, type: "void (string)"
    publish function: :LongMessage, type: "void (string)"
    publish function: :Warning, type: "void (string)"
    publish function: :Error, type: "void (string)"
    publish function: :DisplayYesNoMessages, type: "void (boolean, integer)"
  end

  Report = ReportClass.new
  Report.main
end
