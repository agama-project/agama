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
# File:  modules/Popup.ycp
# Package:  yast2
# Summary:  Commonly used popup dialogs
# Authors:  Gabriele Strattner <gs@suse.de>
#    Stefan Hundhammer <sh@suse.de>
#    Arvin Schnell <arvin@suse.de>
# Flags:  Stable
#
# $Id$
#
# Contains commonly used popup dialogs
# for general usage, e.g. Popup::YesNo(), Popup::ContinueCancel().
# <br>
# See also <a href="../wizard/README.popups">README.popups</a>
require "yast"
require "erb"
# when we need to modify some old method, then sometimes it is easier to replace it with new one
require "yast2/popup"

module Yast
  class PopupClass < Module
    def main
      Yast.import "UI"

      textdomain "base"

      Yast.import "Label"
      Yast.import "Mode"
      Yast.import "Directory"

      @feedback_open = false

      # default size of the richtext widget in richtext popups
      @default_width = 60
      @default_height = 10

      # if error message is too long, show LongError instead of Error Popup
      @switch_to_richtext = true

      # lines of message text which force usage of RichText
      @too_many_lines = 20
    end

    # Internal function that returns a popup dialog with an additional label.
    #
    # @param [String] headline  headline to show or Popup::NoHeadline()
    # @param [String] message  message text to show
    # @param [Yast::Term] button_box  term with one or more buttons
    # @param [String] label    second label with id `label which can be used e.g. for time out value displaying
    #
    # @return [Yast::Term] the layout contents as a term
    def popupLayoutInternalTypeWithLabel(headline, message, button_box, label, richtext, width, height)
      button_box = deep_copy(button_box)
      rt = VWeight(
        1,
        VBox(
          HSpacing(width),
          HBox(
            VSpacing(height),
            RichText(message)
          )
        )
      )

      content = if Ops.greater_than(Builtins.size(headline), 0)
        VBox(
          VSpacing(0.4),
          VBox(
            Left(Heading(headline)),
            VSpacing(0.2),
            richtext ? rt : Left(Label(message)),
            VSpacing(0.2),
            (!label.nil? && label != "") ? Label(Id(:label), label) : Empty()
          )
        ) # no headline
      else
        VBox(
          VSpacing(0.4),
          VBox(
            richtext ? rt : VCenter(Label(message)),
            VSpacing(0.2),
            (!label.nil? && label != "") ? Label(Id(:label), label) : Empty()
          )
        )
      end

      dialog = HBox(
        HSpacing(1),
        VBox(
          VSpacing(0.2),
          content,
          richtext ? Empty() : VStretch(),
          button_box,
          richtext ? Empty() : VStretch(),
          VSpacing(0.2)
        ),
        HSpacing(1)
      )

      deep_copy(dialog)
    end

    # Internal function - wrapper for popupLayoutInternalTypeWithLabel call
    def popupLayoutInternal(headline, message, button_box)
      button_box = deep_copy(button_box)
      popupLayoutInternalTypeWithLabel(
        headline,
        message,
        button_box,
        nil,
        false,
        0,
        0
      )
    end

    # Internal function - wrapper for popupLayoutInternalTypeWithLabel call
    def popupLayoutInternalRich(headline, message, button_box, width, height)
      button_box = deep_copy(button_box)
      popupLayoutInternalTypeWithLabel(
        headline,
        message,
        button_box,
        nil,
        true,
        width,
        height
      )
    end

    # Internal version of AnyTimedMessage
    #
    # Show a message with optional headline above and
    # wait until user clicked "OK" or until a timeout runs out.
    #
    # @param [String] headline  optional headline or Popup::NoHeadline()
    # @param [String] message  the message (maybe multi-line) to display.
    # @param [Fixnum] timeout  After timeout seconds dialog will be automatically closed
    #
    # @return [void]
    #
    def anyTimedMessageTypeInternal(headline, message, timeout, richtext, width, height)
      button_box = ButtonBox(
        # FIXME: BNC #422612, Use `opt(`noSanityCheck) later
        PushButton(Id(:stop), Opt(:cancelButton), Label.StopButton),
        PushButton(Id(:ok_msg), Opt(:default, :okButton), Label.OKButton)
      )

      success = UI.OpenDialog(
        Opt(:decorated),
        popupLayoutInternalTypeWithLabel(
          headline,
          message,
          button_box,
          Builtins.sformat("%1", timeout),
          richtext,
          width,
          height
        )
      )

      UI.SetFocus(Id(:ok_msg)) if success == true

      button = nil

      while Ops.greater_than(timeout, 0) && button != :ok_msg
        button = Convert.to_symbol(UI.TimeoutUserInput(1000))

        if button == :stop
          while UI.UserInput != :ok_msg

          end
          break
        end

        timeout = Ops.subtract(timeout, 1)

        UI.ChangeWidget(Id(:label), :Value, Builtins.sformat("%1", timeout)) if success == true
      end

      UI.CloseDialog if success == true

      nil
    end

    # Internal function - wrapper for anyTimedMessageTypeInternal call
    def anyTimedMessageInternal(headline, message, timeout)
      anyTimedMessageTypeInternal(
        headline,
        message,
        timeout,
        false,
        0,
        0
      )

      nil
    end

    # Internal function - wrapper for anyTimedMessageTypeInternal call
    def anyTimedRichMessageInternal(headline, message, timeout, width, height)
      anyTimedMessageTypeInternal(
        headline,
        message,
        timeout,
        true,
        width,
        height
      )

      nil
    end

    # Indicator for empty headline for popups that can optionally have one
    #
    # This is really just an alias for the empty string "", but it is
    # slightly better readable.
    #
    # @return empty string ("")
    def NoHeadline
      ""
    end

    # Button box for the AnyQuestion Dialog (internal function).
    #
    # @param [String] yes_button_message  label on affirmative buttons (on left side)
    # @param [String] no_button_message  label on negating button (on right side)
    # @param [Symbol] focus      `focus_yes (first button) or `focus_no (second button)
    #
    # @return [Yast::Term] button box
    def AnyQuestionButtonBox(yes_button_message, no_button_message, focus)
      yes_opts = [:okButton]
      no_opts = [:cancelButton]

      if focus == :focus_no
        no_opts << :default
      else
        yes_opts << :default
      end

      yes_button = PushButton(Id(:yes), Opt(*yes_opts), yes_button_message)
      no_button = PushButton(Id(:no), Opt(*no_opts), no_button_message)

      ButtonBox(yes_button, no_button)
    end

    # Generic question popup with two buttons.
    #
    # Style guide hint: The first button has to have the semantics of "yes",
    # "OK", "continue" etc., the second its opposite ("no", "cancel", ...).
    # NEVER use this generic question popup to simply exchange the order of
    # yes/no, continue/cancel or ok/cancel buttons!
    #
    # @param [String] headline    headline or Popup::NoHeadline()
    # @param [String] message    message string
    # @param [String] yes_button_message  label on affirmative buttons (on left side)
    # @param [String] no_button_message  label on negating button (on right side)
    # @param [Symbol] focus      `focus_yes (first button) or `focus_no (second button)
    # ![screenshots/AnyQuestion.png](../../screenshots/AnyQuestion.png)
    #
    # @return true:  first button has been clicked
    #   false: second button has been clicked
    #
    # @see #YesNo
    # @see #ContinueCancel
    #
    # @example Popup::AnyQuestion( Label::WarningMsg(), "Do really want to ...?", "Install", "Don't do it", `focus_no );
    def AnyQuestion(headline, message, yes_button_message, no_button_message, focus)
      button_box = AnyQuestionButtonBox(
        yes_button_message,
        no_button_message,
        focus
      )
      success = UI.OpenDialog(
        Opt(:decorated),
        popupLayoutInternal(
          headline,
          message,
          button_box
        )
      )

      ret = nil

      if success == true
        ret = UI.UserInput
        UI.CloseDialog
      end

      ret == :yes
    end

    # Generic error question popup with two buttons.
    #
    # Style guide hint: The first button has to have the semantics of "yes",
    # "OK", "continue" etc., the second its opposite ("no", "cancel", ...).
    # NEVER use this generic question popup to simply exchange the order of
    # yes/no, continue/cancel or ok/cancel buttons!
    #
    # @param [String] headline    headline or Popup::NoHeadline()
    # @param [String] message    message string
    # @param [String] yes_button_message  label on affirmative buttons (on left side)
    # @param [String] no_button_message  label on negating button (on right side)
    # @param [Symbol] focus      `focus_yes (first button) or `focus_no (second button)
    # ![screenshots/AnyQuestion.png](../../screenshots/AnyQuestion.png)
    #
    # @return true:  first button has been clicked
    #   false: second button has been clicked
    #
    # @see #YesNo
    # @see #ContinueCancel
    #
    # @example Popup::ErrorAnyQuestion( Label::WarningMsg(), "Do really want to ...?", "Install", "Don't do it", `focus_no );
    def ErrorAnyQuestion(headline, message, yes_button_message, no_button_message, focus)
      button_box = AnyQuestionButtonBox(
        yes_button_message,
        no_button_message,
        focus
      )
      success = UI.OpenDialog(
        Opt(:decorated),
        popupLayoutInternal(
          headline,
          message,
          button_box
        )
      )

      ret = nil

      if success == true
        ret = UI.UserInput
        UI.CloseDialog
      end

      ret == :yes
    end

    # Timed question popup with two buttons and time display
    #
    # @param [String] headline    headline or Popup::NoHeadline()
    # @param [String] message    message string
    # @param [String] yes_button_message  label on affirmative buttons (on left side)
    # @param [String] no_button_message  label on negating button (on right side)
    # @param [Symbol] focus      `focus_yes (first button) or `focus_no (second button)
    # @param [Fixnum] timeout_seconds  timeout, if 0, normal behaviour
    # @return [Boolean]              True if Yes, False if no
    # @see #AnyQuestion
    def TimedAnyQuestion(headline, message, yes_button_message, no_button_message, focus, timeout_seconds)
      button_box = AnyQuestionButtonBox(
        yes_button_message,
        no_button_message,
        focus
      )
      timed = ReplacePoint(
        Id(:replace_buttons),
        VBox(
          HCenter(Label(Id(:remaining_time), Ops.add("", timeout_seconds))),
          ButtonBox(
            # FIXME: BNC #422612, Use `opt(`noSanityCheck) later
            PushButton(Id(:timed_stop), Opt(:cancelButton), Label.StopButton),
            PushButton(
              Id(:timed_ok),
              Opt(:default, :key_F10, :okButton),
              Label.OKButton
            )
          ),
          VSpacing(0.2)
        )
      )

      success = UI.OpenDialog(
        Opt(:decorated),
        popupLayoutInternal(headline, message, timed)
      )

      while Ops.greater_than(timeout_seconds, 0)
        which_input = UI.TimeoutUserInput(1000)

        break if which_input == :timed_ok

        if which_input == :timed_stop
          UI.ReplaceWidget(Id(:replace_buttons), button_box)
          which_input = UI.UserInput while which_input == :timed_stop
          break
        end
        timeout_seconds = Ops.subtract(timeout_seconds, 1)

        next unless success

        UI.ChangeWidget(
          Id(:remaining_time),
          :Value,
          Ops.add("", timeout_seconds)
        )
      end

      UI.CloseDialog if success == true

      which_input == :yes
    end

    # Timed error question popup with two buttons and time display
    #
    # @param [String] headline    headline or Popup::NoHeadline()
    # @param [String] message    message string
    # @param [String] yes_button_message  label on affirmative buttons (on left side)
    # @param [String] no_button_message  label on negating button (on right side)
    # @param [Symbol] focus      `focus_yes (first button) or `focus_no (second button)
    # @param [Fixnum] timeout_seconds  timeout, if 0, normal behaviour
    # @return [Boolean]              True if Yes, False if no
    # @see #AnyQuestion
    def TimedErrorAnyQuestion(headline, message, yes_button_message, no_button_message, focus, timeout_seconds)
      buttons = { yes: yes_button_message, no: no_button_message }
      focus_symbol = (focus == :focus_no) ? :no : :yes
      ret = Yast2::Popup.show(message, headline: headline, buttons: buttons,
        focus: focus_symbol, timeout: timeout_seconds)

      ret == :yes
    end

    # Dialog which displays the "message" and has a <b>Continue</b>
    # and a <b>Cancel</b> button.
    #
    # This popup should be used to confirm possibly dangerous actions and if
    # it's useful to display a short headline (without headline
    # Popup::ContinueCancel() can be used).
    # The default button is Continue.
    #
    # Returns true if Continue is clicked.
    #
    # ![screenshot/ContinueCancelHeadline.png](../../screenshot/ContinueCancelHeadline.png)
    #
    # @param [String] headline short headline or Popup::NoHeadline()
    # @param [String] message  message string
    # @return [Boolean]
    #
    # @example Popup::ContinueCancelHeadline ( "Short Header", "Going on with action....?" );
    #
    # @see #ContinueCancel
    # @see #YesNo
    # @see #AnyQuestion
    def ContinueCancelHeadline(headline, message)
      ret = AnyQuestion(
        headline,
        message,
        Label.ContinueButton,
        Label.CancelButton,
        :focus_yes
      )

      Builtins.y2debug("ContinueCancelHeadline returned: %1", ret)

      ret
    end

    # Dialog which displays the "message" and has a <b>Continue</b>
    # and a <b>Cancel</b> button.
    #
    # This popup should be used to confirm possibly dangerous actions.
    # The default button is Continue.
    # Returns true if Continue is clicked.
    #
    # ![screenshots/ContinueCancel.png](../../screenshots/ContinueCancel.png)
    #
    # @param [String] message  message string
    # @return [Boolean]
    #
    # @example Popup::ContinueCancel ( "Please insert required CD-ROM." );
    #
    # @see #AnyQuestion
    def ContinueCancel(message)
      ret = ContinueCancelHeadline(NoHeadline(), message)
      Builtins.y2debug("ContinueCancel returned: %1", ret)

      ret
    end

    # This dialog displays "message" (a question) and has a <b>Yes</b> and
    # a <b>No</b> button.
    #
    # It should be used for decisions about two about equivalent paths,
    # not for simple confirmation - use "Popup::ContinueCancel()" for those.
    # A short headline can be displayed (without headline you can use Popup::YesNo()).
    #
    # The default button is Yes.
    #
    # Returns true if <b>Yes</b> is clicked.
    #
    # ![screenshots/YesNoHeadline.png](../../screenshots/YesNoHeadline.png)
    #
    # @param [String] headline  short headline or Popup::NoHeadline()
    # @param [String] message  message string
    # @return [Boolean]  true if [Yes] has been pressed
    #
    # @example  Popup::YesNoHeadline ( "Resize Windows Partition?", "... explanation of dangers ..." );
    #
    # @see #YesNo
    # @see #AnyQuestion
    def YesNoHeadline(headline, message)
      ret = AnyQuestion(
        headline,
        message,
        Label.YesButton,
        Label.NoButton,
        :focus_yes
      )

      Builtins.y2debug("YesNoHeadline returned: %1", ret)

      ret
    end

    # Display a yes/no question and wait for answer.
    #
    # Should be used for decisions about two about equivalent paths,
    # not for simple confirmation - use "Popup::ContinueCancel()" for those.
    # The default button is Yes.
    # Returns true if <b>Yes</b> is clicked.
    #
    # ![screenshots/YesNo.png](../../screenshots/YesNo.png)
    #
    # @param [String] message  message string
    # @return [Boolean]  true if [Yes] has been pressed
    #
    # @example  Popup::YesNo ( "Create a backup of the config files?" );
    #
    # @see #YesNoHeadline
    # @see #ContinueCancel
    # @see #AnyQuestion
    def YesNo(message)
      ret = YesNoHeadline(NoHeadline(), message)

      Builtins.y2debug("YesNo returned: %1", ret)

      ret
    end

    # Show a long text that might need scrolling.
    #
    # Pass a RichText widget with the parameters appropriate for your text -
    # i.e. without special parameters for HTML-like text or with
    # `opt(`plainText) for plain ASCII text without HTML tags.
    #
    # ![screenshots/LongText.png](../../screenshots/LongText.png)
    #
    # @param [String] headline short headline
    # @param [Yast::Term] richtext  text input is `Richtext()
    # @param [Fixnum] hdim  initial horizontal dimension of the popup
    # @param [Fixnum] vdim  initial vertical dimension of the popup
    #
    # @example Popup::LongText ( "Package description", `Richtext("<p>Hello, this is a long description .....</p>"), 50, 20 );
    def LongText(headline, richtext, hdim, vdim)
      richtext = deep_copy(richtext)
      success = UI.OpenDialog(
        Opt(:decorated),
        HBox(
          VSpacing(vdim),
          VBox(
            HSpacing(hdim),
            Left(Heading(headline)),
            VSpacing(0.2),
            richtext, # scrolled text
            ButtonBox(
              PushButton(
                Id(:ok),
                Opt(:default, :key_F10, :okButton),
                Label.OKButton
              )
            )
          )
        )
      )

      if success == true
        UI.SetFocus(Id(:ok))
        UI.UserInput
        UI.CloseDialog
      end

      nil
    end

    # Show a question that might need scrolling.
    #
    # @param [String] headline short headline
    # @param [String] richtext  text input as a rich text
    # @param [Fixnum] hdim  initial horizontal dimension of the popup
    # @param [Fixnum] vdim  initial vertical dimension of the popup
    # @param [String] yes_button_message message on the left/true button
    # @param [String] no_button_message message on the right/false button
    # @param [Symbol] focus `focus_yes, `focus_no, `focus_none
    # @return left button pressed?
    def AnyQuestionRichText(headline, richtext, hdim, vdim, yes_button_message, no_button_message, focus)
      yes_button = PushButton(
        Id(:ok),
        if focus == :focus_yes
          Opt(:default, :key_F10, :okButton)
        else
          Opt(:key_F10, :okButton)
        end,
        yes_button_message
      )

      no_button = PushButton(
        Id(:cancel),
        (focus == :focus_no) ? Opt(:default, :key_F9) : Opt(:key_F9),
        no_button_message
      )

      d = HBox(
        VSpacing(vdim),
        VBox(
          HSpacing(hdim),
          if Ops.greater_than(Builtins.size(headline), 0)
            Left(Heading(headline))
          else
            Empty()
          end,
          VSpacing(0.2),
          RichText(richtext),
          ButtonBox(yes_button, no_button)
        )
      )

      success = UI.OpenDialog(Opt(:decorated), d)
      ui = nil

      if success == true
        ui = UI.UserInput
        UI.CloseDialog
      end

      ui == :ok
    end

    # Confirmation for "Abort" button during installation.
    #
    # According to the "severity" parameter an appropriate text will be
    # displayed indicating what the user has to expect when he really aborts now.
    #
    # ![screenshots/ConfirmAbort.png](../../screenshots/ConfirmAbort.png)
    #
    # @param [Symbol] severity    `painless, `incomplete, `unusable
    #
    # @return [Boolean]
    #
    # @example Popup::ConfirmAbort ( `painless );
    def ConfirmAbort(severity)
      what_will_happen = ""

      # Confirm user request to abort installation
      abort_label = _("Really abort the installation?")
      # Button that will really abort the installation
      abort_button = _("&Abort Installation")
      # Button that will continue with the installation
      continue_button = _("&Continue Installation")

      case severity
      when :painless
        if Mode.repair
          # Confirm user request to abort System Repair
          abort_label = _("Really abort YaST System Repair?")
          # Button that will really abort the repair
          abort_button = _("Abort System Repair")
          # Button that will continue with the repair
          continue_button = _("&Continue System Repair")
        else
          # Warning text for aborting an installation before anything is installed
          what_will_happen = _(
            "If you abort the installation now,\n" \
            "Linux will not be installed.\n" \
            "Your hard disk will remain untouched."
          )
        end
      when :incomplete
        # Warning text for aborting an installation during the install process
        # - After some installation steps have been performed - e.g.
        # disks formatted / some packages already installed
        what_will_happen = _(
          "If you abort the installation now, you will\n" \
          "have an incomplete Linux system\n" \
          "that might or might not be usable.\n" \
          "You might need to reinstall.\n"
        )
      when :unusable
        # Warning text for aborting an installation during the install process
        # right in the middle of some critical process (e.g. formatting)
        what_will_happen = _(
          "If you abort the installation now,\n" \
          "Linux will be unusable.\n" \
          "You will need to reinstall."
        )
      else
        Builtins.y2error("Unknown symbol for ConfirmAbort")
      end

      message = Ops.add(Ops.add(abort_label, "\n\n"), what_will_happen)

      button_box = AnyQuestionButtonBox(
        abort_button,
        continue_button,
        :focus_no
      )
      success = UI.OpenDialog(
        Opt(:decorated),
        popupLayoutInternal(
          NoHeadline(),
          message,
          button_box
        )
      )

      user_ret = nil
      if success == true
        user_ret = UI.UserInput
        UI.CloseDialog
      end

      ret = user_ret == :yes

      Builtins.y2debug("ConfirmAbort returned: %1", ret)

      ret
    end

    # Confirmation popup when user clicked "Abort".
    #
    # Set "have changes" to "true" when there are changes that will be lost.
    # Note: If there are none, it is good policy to ask for confirmation
    # anyway, but of course with "have_changes" set to "false" so the user
    # isn't warned about changes that might be lost.
    #
    # @param [Boolean] have_changes  true:  There are changes that will be lost
    #      false: No changes
    #
    # @return  true: "abort" confirmed;
    #    false: don't abort
    def ReallyAbort(have_changes)
      focus = :focus_yes

      # Confirm aborting the program
      message = _("Really abort?")

      if have_changes
        focus = :focus_no

        # Additional hint when trying to abort program in spite of changes
        message = Ops.add(
          Ops.add(message, "\n"),
          _("All changes will be lost!")
        )
      end

      ret = AnyQuestion(
        NoHeadline(),
        message,
        Label.YesButton,
        Label.NoButton,
        focus
      )

      Builtins.y2debug("ReallyAbort returned: %1", ret)

      ret
    end

    # Generic message popup with Details button - internal
    #
    # Show a message with optional headline above and
    # wait until user clicked "OK" or "Details". On "Details", show window with detailed information.
    #
    # @param [String] headline  optional headline or Popup::NoHeadline()
    # @param [String] message  the message (maybe multi-line) to display.
    # @param [String] details  the detailed information text
    def anyMessageDetailsInternalType(headline, message, details, richtext, width, height)
      button_box = ButtonBox(
        PushButton(Id(:ok_msg), Opt(:default, :okButton), Label.OKButton),
        # FIXME: BNC #422612, Use `opt(`noSanityCheck) later
        # button label
        PushButton(Id(:details), Opt(:cancelButton), _("&Details..."))
      )

      success = UI.OpenDialog(
        Opt(:decorated),
        if richtext
          popupLayoutInternalRich(
            headline,
            message,
            button_box,
            width,
            height
          )
        else
          popupLayoutInternal(headline, message, button_box)
        end
      )

      UI.SetFocus(Id(:ok_msg))

      loop do
        ret = UI.UserInput
        break if ret != :details

        success2 = UI.OpenDialog(
          Opt(:decorated),
          HBox(
            VSpacing(@default_height),
            VBox(
              HSpacing(@default_width),
              VSpacing(0.5),
              RichText(
                Builtins.mergestring(
                  Builtins.splitstring(ERB::Util.html_escape(details), "\n"),
                  "<br>"
                )
              ),
              VSpacing(),
              ButtonBox(
                PushButton(
                  Id(:ok),
                  Opt(:default, :key_F10, :okButton),
                  Label.OKButton
                )
              )
            )
          )
        )

        if success2 == true
          UI.UserInput
          UI.CloseDialog
        end
      end
      UI.CloseDialog if success == true

      nil
    end

    # Generic message popup - internal
    #
    # Show a message with optional headline above and
    # wait until user clicked "OK".
    #
    # @param [String] headline  optional headline or Popup::NoHeadline()
    # @param [String] message  the message (maybe multi-line) to display.
    def anyMessageInternalType(headline, message, richtext, width, height)
      button_box = ButtonBox(
        PushButton(
          Id(:ok_msg),
          Opt(:default, :key_F10, :okButton),
          Label.OKButton
        )
      )

      success = UI.OpenDialog(
        Opt(:decorated),
        if richtext
          popupLayoutInternalRich(
            headline,
            message,
            button_box,
            width,
            height
          )
        else
          popupLayoutInternal(headline, message, button_box)
        end
      )

      if success == true
        UI.SetFocus(Id(:ok_msg))
        UI.UserInput
        UI.CloseDialog
      end

      nil
    end

    # Internal function - wrapper for anyMessageInternal call
    def anyMessageInternal(headline, message)
      anyMessageInternalType(headline, message, false, 0, 0)

      nil
    end

    # Internal function - wrapper for anyMessageInternal call
    def anyMessageInternalRich(headline, message, width, height)
      anyMessageInternalType(headline, message, true, width, height)

      nil
    end

    # Internal function - wrapper for anyMessageDetailsInternalType call
    def anyMessageDetailsInternal(headline, message, details)
      anyMessageDetailsInternalType(
        headline,
        message,
        details,
        false,
        0,
        0
      )

      nil
    end

    # Generic message popup - internal
    #
    # Show a message with optional headline above and
    # wait until user clicked "OK".
    #
    # @param [String] headline  optional headline or Popup::NoHeadline()
    # @param [String] message  the message (maybe multi-line) to display.
    def anyRichMessageInternal(headline, message, width, height)
      button_box = ButtonBox(
        PushButton(Id(:ok_msg), Opt(:default, :key_F10), Label.OKButton)
      )

      success = UI.OpenDialog(
        Opt(:decorated),
        popupLayoutInternalRich(
          headline,
          message,
          button_box,
          width,
          height
        )
      )

      if success == true
        UI.SetFocus(Id(:ok_msg))
        UI.UserInput
        UI.CloseDialog
      end

      nil
    end

    # Generic message popup
    #
    # Show a message with optional headline above and
    # wait until user clicked "OK".
    #
    # @param [String] headline  optional headline or Popup::NoHeadline()
    # @param [String] message  the message (maybe multi-line) to display.
    def AnyMessage(headline, message)
      anyMessageInternal(headline, message)

      nil
    end

    # Clear feedback message
    # @return [void]
    def ClearFeedback
      UI.CloseDialog if @feedback_open
      @feedback_open = false

      nil
    end

    # Show popup with a headline and a message for feedback
    # @param [String] headline headline of Feedback popup
    # @param [String] message the feedback message
    # @return [void]
    def ShowFeedback(headline, message)
      UI.CloseDialog if @feedback_open
      button_box = Empty()
      UI.BusyCursor
      UI.OpenDialog(
        Opt(:decorated),
        popupLayoutInternal(
          headline,
          message,
          button_box
        )
      )

      @feedback_open = true
      @feedback_headline = headline
      @feedback_message = message

      nil
    end

    # Run the block with a feeback popup
    # The popup is automatically closed at the end
    # (even when an exception is raised)
    # @see {ShowFeedback} and {ClearFeedback} for details
    # To suppress temporary feedback see {SuppressFeedback}
    #
    # @param headline [String] popup headline (displayed in bold)
    # @param message [String] message with details, displayed below the headline
    # @param block block to execute
    def Feedback(headline, message, &block)
      raise ArgumentError, "block must be supplied" unless block

      ShowFeedback(headline, message)
      block.call
    ensure
      ClearFeedback()
    end

    # Hides feedback during block execution.
    # After block it is shown again. When exception is raised, then it is
    # NOT shown again.
    # @see {Feedback}, {ShowFeedback} and {ClearFeedback} for details
    # @param block block to execute
    def SuppressFeedback(&block)
      raise ArgumentError, "block must be supplied" unless block

      return block.call unless @feedback_open # just call block if feedback is not open

      ClearFeedback()
      block.call
      ShowFeedback(@feedback_headline, @feedback_message)
    end

    # Show a simple message and wait until user clicked "OK".
    #
    #
    # @param [String] message message string
    #
    # @example  Popup::Message("This is an information about ... ." );
    #
    # ![screenshots/Message.png](../../screenshots/Message.png)
    # @see #AnyMessage
    # @see #Notify
    # @see #Warning
    # @see #Error
    def Message(message)
      anyMessageInternal(NoHeadline(), message)

      nil
    end

    # Show a long message and wait until user clicked "OK".
    #
    # @param [String] message message string (may contain rich text tags)
    def LongMessage(message)
      anyMessageInternalRich(
        NoHeadline(),
        message,
        @default_width,
        @default_height
      )

      nil
    end

    # Show a long message and wait until user clicked "OK". Size of the popup window is adjustable.
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] width width of the popup window
    # @param [Fixnum] height height of the popup window
    def LongMessageGeometry(message, width, height)
      anyMessageInternalRich(
        NoHeadline(),
        message,
        width,
        height
      )

      nil
    end

    # Show a message and wait until user clicked "OK" or time is out
    #
    # @param [String] message message string
    # @param [Fixnum] timeout_seconds time out in seconds
    def TimedMessage(message, timeout_seconds)
      anyTimedMessageInternal(
        NoHeadline(),
        message,
        timeout_seconds
      )

      nil
    end

    # Show a long message and wait until user clicked "OK" or time is out.
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] timeout_seconds time out in seconds
    def TimedLongMessage(message, timeout_seconds)
      anyTimedRichMessageInternal(
        NoHeadline(),
        message,
        timeout_seconds,
        @default_width,
        @default_height
      )

      nil
    end

    # Show a long message and wait until user clicked "OK" or time is out. Size of the popup window is adjustable.
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] timeout_seconds time out in seconds
    # @param [Fixnum] width width of the popup window
    # @param [Fixnum] height height of the popup window
    def TimedLongMessageGeometry(message, timeout_seconds, width, height)
      anyTimedRichMessageInternal(
        NoHeadline(),
        message,
        timeout_seconds,
        width,
        height
      )

      nil
    end

    # Show a message with Details button and wait until user clicked "OK".
    #
    # @param [String] message  message string
    # @param [String] details  detailed information string
    # @example  Popup::MessageDetails("This is an information about ... .", "This service is intended to...");
    #
    # @see #Message
    def MessageDetails(message, details)
      anyMessageDetailsInternal(
        NoHeadline(),
        message,
        details
      )

      nil
    end

    # Show a warning message and wait until user clicked "OK".
    #
    #
    # @param [String] message warning message string
    #
    # @example Popup::Warning("Something is wrong. Please check your configuration." );
    #
    # ![screenshots/Warning.png](../../screenshots/Warning.png)
    # @see #Message
    # @see #Notify
    # @see #Error
    # @see #AnyMessage
    def Warning(message)
      anyMessageInternal(Label.WarningMsg, message)

      nil
    end

    # Show a long warning and wait until user clicked "OK".
    #
    # @param [String] message message string (may contain rich text tags)
    def LongWarning(message)
      anyMessageInternalRich(
        Label.WarningMsg,
        message,
        @default_width,
        @default_height
      )

      nil
    end

    # Show a long warning and wait until user clicked "OK". Size of the popup window is adjustable
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] width width of the popup window
    # @param [Fixnum] height height of the popup window
    def LongWarningGeometry(message, width, height)
      anyMessageInternalRich(
        Label.WarningMsg,
        message,
        width,
        height
      )

      nil
    end

    # Show a warning message and wait specified amount of time or until user clicked "OK".
    #
    # ![screenshots/TimedWarningPopup.png](../../screenshots/TimedWarningPopup.png)
    #
    # @param [String] message warning message string
    # @param [Fixnum] timeout_seconds time out in seconds
    #
    # @return [void]
    #
    # @see #Warning
    def TimedWarning(message, timeout_seconds)
      anyTimedMessageInternal(
        Label.WarningMsg,
        message,
        timeout_seconds
      )

      nil
    end

    # Show a long warning message and wait until user clicked "OK" or time is out.
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] timeout_seconds time out in seconds
    def TimedLongWarning(message, timeout_seconds)
      anyTimedRichMessageInternal(
        Label.WarningMsg,
        message,
        timeout_seconds,
        @default_width,
        @default_height
      )

      nil
    end

    # Show a long warning and wait until user clicked "OK" or time is out. Size of the popup window is adjustable.
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] timeout_seconds time out in seconds
    # @param [Fixnum] width width of the popup window
    # @param [Fixnum] height height of the popup window
    def TimedLongWarningGeometry(message, timeout_seconds, width, height)
      anyTimedRichMessageInternal(
        Label.WarningMsg,
        message,
        timeout_seconds,
        width,
        height
      )

      nil
    end

    # Show a warning with Details button and wait until user clicked "OK".
    #
    # @param [String] message  warning message string
    # @param [String] details  detailed information string
    # @example Popup::WarningDetails("Something is wrong. Please check your configuration.", "possible problem is in..." );
    #
    # @see #Message
    def WarningDetails(message, details)
      anyMessageDetailsInternal(
        Label.WarningMsg,
        message,
        details
      )

      nil
    end

    # Show an error message and wait until user clicked "OK".
    #
    # @param [String] message  error message string
    #
    # @example  Popup::Error("The configuration was not succesful." );
    # ![screenshots/Error.png](../../screenshots/Error.png)
    #
    # @see #Message
    # @see #Notify
    # @see #Warning
    # @see #AnyMessage
    def Error(message)
      lines = Builtins.splitstring(message, "\n")
      if @switch_to_richtext &&
          Ops.greater_than(Builtins.size(lines), @too_many_lines)
        anyMessageInternalRich(
          Label.ErrorMsg,
          ERB::Util.html_escape(message),
          @default_width,
          @default_height
        )
      else
        anyMessageInternal(Label.ErrorMsg, message)
      end

      nil
    end

    # Show a long error and wait until user clicked "OK".
    #
    # @param [String] message message string (may contain rich text tags)
    def LongError(message)
      anyMessageInternalRich(
        Label.ErrorMsg,
        message,
        @default_width,
        @default_height
      )

      nil
    end

    # Show a long error message and wait until user clicked "OK". Size of the popup window is adjustable.
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] width width of the popup window
    # @param [Fixnum] height height of the popup window
    def LongErrorGeometry(message, width, height)
      anyMessageInternalRich(
        Label.ErrorMsg,
        message,
        width,
        height
      )

      nil
    end

    # Show an error message and wait specified amount of time or until user clicked "OK".
    #
    # ![screenshots/TimedErrorPopup.png](../../screenshots/TimedErrorPopup.png)
    #
    # @param [String] message  error message string
    # @param [Fixnum] timeout_seconds time out in seconds
    #
    # @return [void]
    #
    # @see #Error
    def TimedError(message, timeout_seconds)
      anyTimedMessageInternal(
        Label.ErrorMsg,
        message,
        timeout_seconds
      )

      nil
    end

    # Show a long error message and wait until user clicked "OK" or time is out.
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] timeout_seconds time out in seconds
    def TimedLongError(message, timeout_seconds)
      anyTimedRichMessageInternal(
        Label.ErrorMsg,
        message,
        timeout_seconds,
        @default_width,
        @default_height
      )

      nil
    end

    # Show a long error message and wait until user clicked "OK" or time is out. Size of the popup window is adjustable.
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] timeout_seconds time out in seconds
    # @param [Fixnum] width width of the popup window
    # @param [Fixnum] height height of the popup window
    def TimedLongErrorGeometry(message, timeout_seconds, width, height)
      anyTimedRichMessageInternal(
        Label.ErrorMsg,
        message,
        timeout_seconds,
        width,
        height
      )

      nil
    end

    # Show an error message with Details button and wait until user clicked "OK".
    #
    # @param [String] message  error message string
    # @param [String] details  detailed information string
    # @example  Popup::ErrorDetails("The configuration was not succesful.", "Service failed to start");
    #
    # @see #Message
    def ErrorDetails(message, details)
      anyMessageDetailsInternal(
        Label.ErrorMsg,
        message,
        details
      )

      nil
    end

    # Show a notification message and wait until user clicked "OK".
    #
    # ![screenshots/Notify.png](../../screenshots/Notify.png)
    #
    # @param [String] message notify message string
    #
    # @example  Popup::Notify("Your printer is ready for use." );
    #
    # @see #Message
    # @see #AnyMessage
    def Notify(message)
      anyMessageInternal("", message)

      nil
    end

    # Show a long notify message and wait until user clicked "OK".
    #
    # @param [String] message message string (may contain rich text tags)
    def LongNotify(message)
      anyMessageInternalRich(
        NoHeadline(),
        message,
        @default_width,
        @default_height
      )

      nil
    end

    # Show a long notify message and wait until user clicked "OK". Size of the popup window is adjustable.
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] width width of the popup window
    # @param [Fixnum] height height of the popup window
    def LongNotifyGeometry(message, width, height)
      anyMessageInternalRich(
        NoHeadline(),
        message,
        width,
        height
      )

      nil
    end

    # Show a long notify message and wait until user clicked "OK" or the time is out.
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] timeout_seconds time out in seconds
    def TimedNotify(message, timeout_seconds)
      anyTimedMessageInternal(
        NoHeadline(),
        message,
        timeout_seconds
      )

      nil
    end

    # Show a long error message and wait until user clicked "OK" or time is out.
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] timeout_seconds time out in seconds
    def TimedLongNotify(message, timeout_seconds)
      anyTimedRichMessageInternal(
        NoHeadline(),
        message,
        timeout_seconds,
        @default_width,
        @default_height
      )

      nil
    end

    # Show a long notify message and wait until user clicked "OK" or time is out. Size of the popup window is adjustable.
    #
    # @param [String] message message string (may contain rich text tags)
    # @param [Fixnum] timeout_seconds time out in seconds
    # @param [Fixnum] width width of the popup window
    # @param [Fixnum] height height of the popup window
    def TimedLongNotifyGeometry(message, timeout_seconds, width, height)
      anyTimedRichMessageInternal(
        NoHeadline(),
        message,
        timeout_seconds,
        width,
        height
      )

      nil
    end

    # Show a notify message with Details button and wait until user clicked "OK".
    #
    # @param [String] message  error message string
    # @param [String] details  detailed information string
    #
    # @see #Message
    def NotifyDetails(message, details)
      anyMessageDetailsInternal(
        NoHeadline(),
        message,
        details
      )

      nil
    end

    # Display a message with a timeout
    #
    # Display a message with a timeout and return when the user clicks "OK", "Cancel"
    # or when the timeout expires ("OK" is assumed then).
    #
    # There is also a "stop" button that will stop the countdown. If the
    # user clicks that, the popup will wait forever (or until "OK" or "Cancel" is
    # clicked, of course).
    #
    # @param [String] message    message to display
    # @param [Fixnum] timeout_seconds    the timeout in seconds
    #
    # @return true  --> "OK" or timer expired<br>
    #   false  --> "Cancel"
    #
    # @example boolean ret = Popup::TimedOKCancel("This is a timed message", 2 );
    def TimedOKCancel(message, timeout_seconds)
      success = UI.OpenDialog(
        Opt(:decorated),
        HBox(
          HSpacing(1),
          VBox(
            VSpacing(0.2),
            Label(message),
            HCenter(Label(Id(:remaining_time), Ops.add("", timeout_seconds))),
            ButtonBox(
              PushButton(Id(:timed_stop), Opt(:customButton), Label.StopButton),
              PushButton(
                Id(:timed_ok),
                Opt(:default, :key_F10, :okButton),
                Label.OKButton
              ),
              PushButton(
                Id(:timed_cancel),
                Opt(:key_F9, :cancelButton),
                Label.CancelButton
              )
            ),
            VSpacing(0.2)
          )
        )
      )

      while Ops.greater_than(timeout_seconds, 0)
        which_input = UI.TimeoutUserInput(1000)
        break if which_input == :timed_ok
        break if which_input == :timed_cancel

        if which_input == :timed_stop
          which_input = UI.UserInput while which_input == :timed_stop
          break
        end
        timeout_seconds = Ops.subtract(timeout_seconds, 1)
        UI.ChangeWidget(
          Id(:remaining_time),
          :Value,
          Ops.add("", timeout_seconds)
        )
      end
      UI.CloseDialog if success == true

      which_input != :timed_cancel
    end

    # Generic question popup with three buttons.
    #
    # @param [String] headline    headline or Popup::NoHeadline()
    # @param [String] message      message string
    # @param [String] yes_button_message  label on affirmative button (on left side)
    # @param [String] no_button_message  label on negating button (middle)
    # @param [String] retry_button_message  label on retry button (on right side)
    # @param [Symbol] focus      `focus_yes (first button), `focus_no (second button) or
    #        `focus_retry (third button)
    #
    # @return - `yes:  first button has been clicked
    #     - `no: second button has been clicked
    #     - `retry: third button has been clicked
    #
    # @see #AnyQuestion
    #
    # @example Popup::AnyQuestion3( Label::WarningMsg(), _("... failed"), _("Continue"), _("Cancel"), _("Retry"), `focus_yes );
    def AnyQuestion3(headline, message, yes_button_message, no_button_message, retry_button_message, focus)
      yes_button = Empty()
      no_button = Empty()
      retry_button = Empty()

      case focus
      when :focus_no
        yes_button = PushButton(
          Id(:yes),
          Opt(:key_F10, :okButton),
          yes_button_message
        )
        no_button = PushButton(
          Id(:no),
          Opt(:default, :key_F9, :cancelButton),
          no_button_message
        )
        retry_button = PushButton(
          Id(:retry),
          Opt(:key_F6, :customButton),
          retry_button_message
        )
      when :focus_yes
        yes_button = PushButton(
          Id(:yes),
          Opt(:default, :key_F10, :okButton),
          yes_button_message
        )
        no_button = PushButton(
          Id(:no),
          Opt(:key_F9, :cancelButton),
          no_button_message
        )
        retry_button = PushButton(
          Id(:retry),
          Opt(:key_F6, :customButton),
          retry_button_message
        )
      else
        yes_button = PushButton(
          Id(:yes),
          Opt(:key_F10, :okButton),
          yes_button_message
        )
        no_button = PushButton(
          Id(:no),
          Opt(:key_F9, :cancelButton),
          no_button_message
        )
        retry_button = PushButton(
          Id(:retry),
          Opt(:default, :key_F6, :customButton),
          retry_button_message
        )
      end

      button_box = ButtonBox(yes_button, no_button, retry_button)

      success = UI.OpenDialog(
        Opt(:decorated),
        popupLayoutInternal(
          headline,
          message,
          button_box
        )
      )

      ret = nil

      if success == true
        ret = Convert.to_symbol(UI.UserInput)
        UI.CloseDialog
      end

      ret
    end

    # Special error popup for YCP modules that don't work.
    #
    # The user can choose one of:
    # - "back" - go back to the previous module
    # - "next" - skip this faulty module and directly go to the next one
    # - "again" - try it again (after fixing something in the code, of course)
    # - "cancel" - exit program
    #
    # ![screenshots/ModuleError.png](../../screenshots/ModuleError.png)
    #
    # @param [String] text   string
    # @return [Symbol] `back, `again, `cancel, `next
    #
    # @example Popup::ModuleError( "The module " + symbolof(argterm) + " does not work." );
    def ModuleError(text)
      success = UI.OpenDialog(
        Opt(:decorated, :warncolor),
        HBox(
          HSpacing(1),
          VBox(
            VSpacing(0.2),
            Heading(text),
            ButtonBox(
              PushButton(
                Id(:back),
                Opt(:key_F8, :customButton),
                Label.BackButton
              ),
              PushButton(
                Id(:again),
                Opt(:key_F6, :customButton),
                Label.RetryButton
              ),
              PushButton(
                Id(:cancel),
                Opt(:key_F9, :cancelButton),
                Label.QuitButton
              ),
              PushButton(Id(:next), Opt(:key_F10, :okButton), Label.NextButton)
            ),
            VSpacing(0.2)
          ),
          HSpacing(1)
        )
      )
      ret = nil

      if success == true
        ret = Convert.to_symbol(UI.UserInput)
        UI.CloseDialog
      end

      ret
    end

    # Generic message popup
    #
    # Show a message with optional headline above and
    # wait until user clicked "OK" or until a timeout runs out.
    #
    # @param [String] headline  optional headline or Popup::NoHeadline()
    # @param [String] message  the message (maybe multi-line) to display.
    # @param [Fixnum] timeout  After timeout seconds dialog will be automatically closed
    #
    # @return [void]
    #
    def AnyTimedMessage(headline, message, timeout)
      anyTimedMessageInternal(headline, message, timeout)

      nil
    end

    def AnyTimedRichMessage(headline, message, timeout)
      anyTimedRichMessageInternal(
        headline,
        message,
        timeout,
        @default_width,
        @default_height
      )

      nil
    end

    # it is misaligned because there used to be UI() around it

    # Show the contents of an entire file in a popup.
    #
    # @param [String] headline  headline text
    # @param [String] text  text to show
    # @param [Fixnum] timeout  text to show
    #
    # @example Popup::ShowText ("Boot Messages", "kernel panic", 10);
    def ShowTextTimed(headline, text, timeout)
      heading = if Builtins.size(headline) == 0
        VSpacing(0.2)
      else
        Heading(headline)
      end

      success = UI.OpenDialog(
        Opt(:decorated),
        VBox(
          HSpacing(70), # force width
          heading,
          VWeight(
            1,
            HBox(
              VSpacing(18), # force height
              HSpacing(0.7),
              RichText(Id(:text), Opt(:plainText), text),
              HSpacing(0.7)
            )
          ),
          VSpacing(0.3),
          Label(Id(:label), Builtins.sformat("%1", timeout)),
          VSpacing(0.2),
          ButtonBox(
            PushButton(
              Id(:ok_msg),
              Opt(:default, :key_F10, :okButton),
              Label.OKButton
            )
          ),
          VSpacing(0.3)
        )
      )

      button = nil

      while Ops.greater_than(timeout, 0) && button != :ok_msg
        button = Convert.to_symbol(UI.TimeoutUserInput(1000))
        timeout = Ops.subtract(timeout, 1)

        UI.ChangeWidget(Id(:label), :Value, Builtins.sformat("%1", timeout))
      end

      UI.CloseDialog if success == true

      nil
    end

    # Show the contents of an entire file in a popup.
    #
    # @param [String] headline  headline text
    # @param [String] text  text to show
    #
    # @example Popup::ShowText ("Boot Messages", "kernel panic");
    def ShowText(headline, text)
      heading = if Builtins.size(headline) == 0
        VSpacing(0.2)
      else
        Heading(headline)
      end

      success = UI.OpenDialog(
        Opt(:decorated),
        VBox(
          HSpacing(70), # force width
          heading,
          VWeight(
            1,
            HBox(
              VSpacing(18), # force height
              HSpacing(0.7),
              RichText(Id(:text), Opt(:plainText), text),
              HSpacing(0.7)
            )
          ),
          VSpacing(0.3),
          ButtonBox(
            PushButton(Opt(:default, :key_F10, :okButton), Label.OKButton)
          ),
          VSpacing(0.3)
        )
      )

      if success == true
        UI.UserInput
        UI.CloseDialog
      end

      nil
    end

    # Show the contents of an entire file in a popup.
    #
    # Notice: This is a WFM function, NOT an UI function!
    #
    # @param [String] headline  headline text
    # @param [String] filename  filename with path of the file to show
    #
    # @example Popup::ShowFile ("Boot Messages", "/var/log/boot.msg");
    def ShowFile(headline, filename)
      text = Convert.to_string(SCR.Read(path(".target.string"), filename))

      ShowText(headline, text)

      nil
    end

    publish variable: :switch_to_richtext, type: "boolean"
    publish variable: :too_many_lines, type: "integer"
    publish function: :NoHeadline, type: "string ()"
    publish function: :AnyQuestion, type: "boolean (string, string, string, string, symbol)"
    publish function: :ErrorAnyQuestion, type: "boolean (string, string, string, string, symbol)"
    publish function: :TimedAnyQuestion, type: "boolean (string, string, string, string, symbol, integer)"
    publish function: :TimedErrorAnyQuestion, type: "boolean (string, string, string, string, symbol, integer)"
    publish function: :ContinueCancelHeadline, type: "boolean (string, string)"
    publish function: :ContinueCancel, type: "boolean (string)"
    publish function: :YesNoHeadline, type: "boolean (string, string)"
    publish function: :YesNo, type: "boolean (string)"
    publish function: :LongText, type: "void (string, term, integer, integer)"
    publish function: :AnyQuestionRichText, type: "boolean (string, string, integer, integer, string, string, symbol)"
    publish function: :ConfirmAbort, type: "boolean (symbol)"
    publish function: :ReallyAbort, type: "boolean (boolean)"
    publish function: :AnyMessage, type: "void (string, string)"
    publish function: :ClearFeedback, type: "void ()"
    publish function: :ShowFeedback, type: "void (string, string)"
    publish function: :Message, type: "void (string)"
    publish function: :LongMessage, type: "void (string)"
    publish function: :LongMessageGeometry, type: "void (string, integer, integer)"
    publish function: :TimedMessage, type: "void (string, integer)"
    publish function: :TimedLongMessage, type: "void (string, integer)"
    publish function: :TimedLongMessageGeometry, type: "void (string, integer, integer, integer)"
    publish function: :MessageDetails, type: "void (string, string)"
    publish function: :Warning, type: "void (string)"
    publish function: :LongWarning, type: "void (string)"
    publish function: :LongWarningGeometry, type: "void (string, integer, integer)"
    publish function: :TimedWarning, type: "void (string, integer)"
    publish function: :TimedLongWarning, type: "void (string, integer)"
    publish function: :TimedLongWarningGeometry, type: "void (string, integer, integer, integer)"
    publish function: :WarningDetails, type: "void (string, string)"
    publish function: :Error, type: "void (string)"
    publish function: :LongError, type: "void (string)"
    publish function: :LongErrorGeometry, type: "void (string, integer, integer)"
    publish function: :TimedError, type: "void (string, integer)"
    publish function: :TimedLongError, type: "void (string, integer)"
    publish function: :TimedLongErrorGeometry, type: "void (string, integer, integer, integer)"
    publish function: :ErrorDetails, type: "void (string, string)"
    publish function: :Notify, type: "void (string)"
    publish function: :LongNotify, type: "void (string)"
    publish function: :LongNotifyGeometry, type: "void (string, integer, integer)"
    publish function: :TimedNotify, type: "void (string, integer)"
    publish function: :TimedLongNotify, type: "void (string, integer)"
    publish function: :TimedLongNotifyGeometry, type: "void (string, integer, integer, integer)"
    publish function: :NotifyDetails, type: "void (string, string)"
    publish function: :TimedOKCancel, type: "boolean (string, integer)"
    publish function: :AnyQuestion3, type: "symbol (string, string, string, string, string, symbol)"
    publish function: :ModuleError, type: "symbol (string)"
    publish function: :AnyTimedMessage, type: "void (string, string, integer)"
    publish function: :AnyTimedRichMessage, type: "void (string, string, integer)"
    publish function: :ShowTextTimed, type: "void (string, string, integer)"
    publish function: :ShowText, type: "void (string, string)"
    publish function: :ShowFile, type: "void (string, string)"
  end

  Popup = PopupClass.new
  Popup.main
end
