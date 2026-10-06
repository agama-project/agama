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
      Yast.import "CommandLine"

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

    # Function sets internal variable, which indicates, that any
    # settings were modified, to "true"
    def SetModified
      @modified = true

      nil
    end

    # Functions which returns if the settings were modified
    # @return [Boolean]  settings were modified
    def GetModified
      @modified
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

    # Get all the Report configuration from a map.
    #
    # the map may be empty.
    #
    # @param [Hash] settings Map with settings (keys: "messages", "errors", "warnings"; values: map
    # @return  success
    def Import(settings)
      settings = deep_copy(settings)
      @message_settings = Ops.get_map(settings, "messages", {})
      @error_settings = Ops.get_map(settings, "errors", {})
      @warning_settings = Ops.get_map(settings, "warnings", {})
      @yesno_message_settings = Ops.get_map(settings, "yesno_messages", {})

      # display flags
      @display_errors = Ops.get_boolean(@error_settings, "show", true)
      @display_warnings = Ops.get_boolean(@warning_settings, "show", true)
      @display_messages = Ops.get_boolean(@message_settings, "show", true)
      @display_yesno_messages = Ops.get_boolean(
        @yesno_message_settings,
        "show",
        true
      )

      # timeouts
      @timeout_errors = Ops.get_integer(@error_settings, "timeout", 0)
      @timeout_warnings = Ops.get_integer(@warning_settings, "timeout",
        @default_timeout)
      @timeout_messages = Ops.get_integer(@message_settings, "timeout",
        @default_timeout)
      @timeout_yesno_messages = Ops.get_integer(
        @yesno_message_settings,
        "timeout",
        @default_timeout
      )

      # logging flags
      @log_errors = Ops.get_boolean(@error_settings, "log", true)
      @log_warnings = Ops.get_boolean(@warning_settings, "log", true)
      @log_messages = Ops.get_boolean(@message_settings, "log", true)
      @log_yesno_messages = Ops.get_boolean(
        @yesno_message_settings,
        "log",
        true
      )

      true
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

    # Clear stored yes/no messages
    # @return [void]
    def ClearYesNoMessages
      @yesno_messages = []

      nil
    end

    # Clear stored messages
    # @return [void]
    def ClearMessages
      @messages = []

      nil
    end

    # Clear stored errors
    # @return [void]
    def ClearErrors
      @errors = []

      nil
    end

    # Clear stored warnings
    # @return [void]
    def ClearWarnings
      @warnings = []

      nil
    end

    # Clear all stored messages (errors, messages and warnings)
    # @return [void]
    def ClearAll
      ClearErrors()
      ClearWarnings()
      ClearMessages()
      ClearYesNoMessages()

      nil
    end

    # Return number of stored yes/no messages
    # @return [Fixnum] number of messages
    def NumYesNoMessages
      Builtins.size(@yesno_messages)
    end

    # Return number of stored messages
    # @return [Fixnum] number of messages
    def NumMessages
      Builtins.size(@messages)
    end

    # Return number of stored warnings
    # @return [Fixnum] number of warnings
    def NumWarnings
      Builtins.size(@warnings)
    end

    # Return number of stored errors
    # @return [Fixnum] number of errors
    def NumErrors
      Builtins.size(@errors)
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

    # Question with headline and Yes/No Buttons
    # @deprecated same as AnyQuestion
    # @param [String] headline Popup Headline
    # @param [String] message Popup Message
    # @param [String] yes_button_message Yes Button Message
    # @param [String] no_button_message No Button Message
    # @param [Symbol] focus Which Button has the focus
    # @return [Boolean] True if Yes is pressed, otherwise false
    def ErrorAnyQuestion(headline, message, yes_button_message, no_button_message, focus)
      AnyQuestion(headline, message, yes_button_message,
        no_button_message, focus)
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
        if Mode.commandline
          CommandLine.Print(message_string)
        else
          timeout = (@timeout_messages.to_s.to_i > 0) ? @timeout_messages : 0
          Yast2::Popup.show(message_string, timeout: timeout)
        end
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
        if Mode.commandline
          CommandLine.Print(message_string)
        else
          timeout = (@timeout_messages.to_s.to_i > 0) ? @timeout_messages : 0
          Yast2::Popup.show(message_string, richtext: true, timeout: timeout)
        end
      end

      @messages = Builtins.add(@messages, message_string)

      nil
    end

    # Store new message text
    # @param [String] headline_string Headline String
    # @param [String] message_string message text, it can contain new line characters ("\n")
    # @return [void]
    def ShowText(headline_string, message_string)
      Builtins.y2milestone(1, "%1", message_string) if @log_errors

      if @display_errors
        if Mode.commandline
          CommandLine.Print(headline_string)
          CommandLine.Print("\n\n")
          CommandLine.Print(message_string)
        else
          timeout = (@timeout_errors.to_s.to_i > 0) ? @timeout_errors : 0
          # this works even for big file due to show feature that switch to richtextbox
          # if text is too long, but do not interpret richtext tags.
          Yast2::Popup.show(message_string, headline: headline_string, timeout: timeout)
        end
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
        if Mode.commandline
          CommandLine.Print "Warning: #{warning_string}"
        else
          timeout = (@timeout_warnings.to_s.to_i > 0) ? @timeout_warnings : 0
          Yast2::Popup.show(warning_string, headline: :warning, timeout: timeout)
        end
      end

      @warnings = Builtins.add(@warnings, warning_string)

      nil
    end

    # Store new warning text, the text is displayed in a richtext widget - long lines are automatically wrapped
    # @param [String] warning_string warning text (it can contain rich text tags)
    # @param width [Integer] width of popup (@see Popup#LongWarningGeometry)
    # @param height [Integer] height of popup (@see Popup#LongWarningGeometry)
    # @return [void]
    def LongWarning(warning_string, width: 60, height: 10)
      Builtins.y2warning(1, "%1", warning_string) if @log_warnings

      if @display_warnings
        if Mode.commandline
          CommandLine.Print("Warning: #{warning_string}")
        else
          timeout = (@timeout_warnings.to_s.to_i > 0) ? @timeout_warnings : 0
          Yast2::Popup.show(warning_string, headline: :warning, richtext: true, timeout: timeout)
        end
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
        if Mode.commandline
          CommandLine.Print "Error: #{error_string}"
        else
          timeout = (@timeout_errors.to_s.to_i > 0) ? @timeout_errors : 0
          Yast2::Popup.show(error_string, headline: :error, timeout: timeout)
        end
      end

      @errors = Builtins.add(@errors, error_string)

      nil
    end

    # Store new error text, the text is displayed in a richtext widget - long lines are automatically wrapped
    # @param [String] error_string error text  (it can contain rich text tags)
    # @param width [Integer] width of popup (@see Popup#LongErrorGeometry)
    # @param height [Integer] height of popup (@see Popup#LongErrorGeometry)
    # @return [void]
    def LongError(error_string, width: 60, height: 10)
      Builtins.y2error(1, "%1", error_string) if @log_errors

      if @display_errors
        if Mode.commandline
          CommandLine.Print "Error: #{error_string}"
        else
          timeout = (@timeout_errors.to_s.to_i > 0) ? @timeout_errors : 0
          Yast2::Popup.show(error_string, headline: :error, richtext: true, timeout: timeout)
        end
      end

      @errors = Builtins.add(@errors, error_string)

      nil
    end

    # Error popup dialog can displayed immediately when new error is stored.
    #
    # This function enables or diables popuping of dialogs.
    #
    # @param [Boolean] display if true then display error popups immediately
    # @param [Fixnum] timeout dialog is automatically closed after timeout seconds. Value 0 means no time out, dialog will be closed only by user.
    # @return [void]
    def DisplayErrors(display, timeout)
      @display_errors = display
      @timeout_errors = timeout
      nil
    end

    # Warning popup dialog can displayed immediately when new warningr is stored.
    #
    # This function enables or diables popuping of dialogs.
    #
    # @param [Boolean] display if true then display warning popups immediately
    # @param [Fixnum] timeout dialog is automatically closed after timeout seconds. Value 0 means no time out, dialog will be closed only by user.
    # @return [void]
    def DisplayWarnings(display, timeout)
      @display_warnings = display
      @timeout_warnings = timeout
      nil
    end

    # Message popup dialog can be displayed immediately when a new message  is stored.
    #
    # This function enables or diables popuping of dialogs.
    #
    # @param [Boolean] display if true then display message popups immediately
    # @param [Fixnum] timeout dialog is automatically closed after timeout seconds. Value 0 means no time out, dialog will be closed only by user.
    # @return [void]

    def DisplayMessages(display, timeout)
      @display_messages = display
      @timeout_messages = timeout
      nil
    end

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

    # Set warnings logging to .y2log file
    # @param [Boolean] log if log is true then warning messages will be logged
    # @return [void]
    def LogWarnings(log)
      @log_warnings = log

      nil
    end

    # Set yes/no messages logging to .y2log file
    # @param [Boolean] log if log is true then  messages will be logged
    # @return [void]
    def LogYesNoMessages(log)
      @log_yesno_messages = log

      nil
    end

    # Set messages logging to .y2log file
    # @param [Boolean] log if log is true then  messages will be logged
    # @return [void]
    def LogMessages(log)
      @log_messages = log

      nil
    end

    # Set warnings logging to .y2log file
    # @param [Boolean] log if log is true then warning messages will be logged
    # @return [void]
    def LogErrors(log)
      @log_errors = log

      nil
    end

    # Create rich text string from stored warning, message or error messages.
    #
    # Every new line character "\n" is replaced by string "[BR]".
    #
    # @param [Boolean] warning include warnings in returned string
    # @param [Boolean] errors include errors in returned string
    # @param [Boolean] messages include messages in returned string
    # @param [Boolean] yes_no include Yes/No messages in returned string
    # @return [String] rich text string
    def GetMessages(warnings, errors, messages, yes_no)
      richtext = ""

      if warnings
        # translators: warnings summary header
        richtext = Ops.add(
          Ops.add(Ops.add(richtext, "<P><B>"), _("Warning:")),
          "</B><BR>"
        )

        Builtins.foreach(@warnings) do |s|
          strs = Builtins.splitstring(s, "\n")
          Builtins.foreach(strs) do |line|
            richtext = Ops.add(Ops.add(richtext, line), "<BR>")
          end
        end

        richtext = Ops.add(richtext, "</P>")
      end

      if errors
        # translators: errors summary header
        richtext = Ops.add(
          Ops.add(Ops.add(richtext, "<P><B>"), _("Error:")),
          "</B><BR>"
        )

        Builtins.foreach(@errors) do |s|
          strs = Builtins.splitstring(s, "\n")
          Builtins.foreach(strs) do |line|
            richtext = Ops.add(Ops.add(richtext, line), "<BR>")
          end
        end

        richtext = Ops.add(richtext, "</P>")
      end

      if messages
        # translators: message summary header
        richtext = Ops.add(
          Ops.add(Ops.add(richtext, "<P><B>"), _("Message:")),
          "</B><BR>"
        )

        Builtins.foreach(@messages) do |s|
          strs = Builtins.splitstring(s, "\n")
          Builtins.foreach(strs) do |line|
            richtext = Ops.add(Ops.add(richtext, line), "<BR>")
          end
        end

        richtext = Ops.add(richtext, "</P>")
      end

      if yes_no
        # translators: message summary header
        richtext = Ops.add(
          Ops.add(Ops.add(richtext, "<P><B>"), _("Message:")),
          "</B><BR>"
        )

        Builtins.foreach(@yesno_messages) do |s|
          strs = Builtins.splitstring(s, "\n")
          Builtins.foreach(strs) do |line|
            richtext = Ops.add(Ops.add(richtext, line), "<BR>")
          end
        end

        richtext = Ops.add(richtext, "</P>")
      end
      richtext
    end
    # rubocop:enable Lint/UnusedMethodArgument

    publish variable: :message_settings, type: "map"
    publish variable: :error_settings, type: "map"
    publish variable: :warning_settings, type: "map"
    publish variable: :yesno_message_settings, type: "map"
    publish variable: :modified, type: "boolean"
    publish function: :SetModified, type: "void ()"
    publish function: :GetModified, type: "boolean ()"
    publish function: :Summary, type: "string ()"
    publish function: :Import, type: "boolean (map)"
    publish function: :Export, type: "map ()"
    publish function: :ClearYesNoMessages, type: "void ()"
    publish function: :ClearMessages, type: "void ()"
    publish function: :ClearErrors, type: "void ()"
    publish function: :ClearWarnings, type: "void ()"
    publish function: :ClearAll, type: "void ()"
    publish function: :NumYesNoMessages, type: "integer ()"
    publish function: :NumMessages, type: "integer ()"
    publish function: :NumWarnings, type: "integer ()"
    publish function: :NumErrors, type: "integer ()"
    publish function: :AnyQuestion, type: "boolean (string, string, string, string, symbol)"
    publish function: :ErrorAnyQuestion, type: "boolean (string, string, string, string, symbol)"
    publish function: :Message, type: "void (string)"
    publish function: :LongMessage, type: "void (string)"
    publish function: :ShowText, type: "void (string, string)"
    publish function: :Warning, type: "void (string)"
    publish function: :LongWarning, type: "void (string)"
    publish function: :Error, type: "void (string)"
    publish function: :LongError, type: "void (string)"
    publish function: :DisplayErrors, type: "void (boolean, integer)"
    publish function: :DisplayWarnings, type: "void (boolean, integer)"
    publish function: :DisplayMessages, type: "void (boolean, integer)"
    publish function: :DisplayYesNoMessages, type: "void (boolean, integer)"
    publish function: :LogWarnings, type: "void (boolean)"
    publish function: :LogYesNoMessages, type: "void (boolean)"
    publish function: :LogMessages, type: "void (boolean)"
    publish function: :LogErrors, type: "void (boolean)"
    publish function: :GetMessages, type: "string (boolean, boolean, boolean, boolean)"
  end

  Report = ReportClass.new
  Report.main
end
