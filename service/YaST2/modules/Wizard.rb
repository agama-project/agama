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
# File:  Wizard.ycp
# Package:  yast2
# Author:  Stefan Hundhammer <sh@suse.de>
#
# Provides the wizard dialog (common screen for all YaST2 installation
# modules) and functions to set the contents, to replace and restore
# special widgets.
require "yast"

module Yast
  class WizardClass < Module
    DEFAULT_ICON_NAME = "yast".freeze

    def main
      Yast.import "UI"
      textdomain "base"

      Yast.import "Desktop"
      Yast.import "Label"
      Yast.import "Popup"
      Yast.import "Directory"
      Yast.import "OSRelease"

      @have_fancy_ui_cache = nil

      # this variable is set from Product:: constructor
      # to setup correct &product; macro in UI
      @product_name = ""

      #
      # Screenshot Functions
      #

      # Currently used screenshot name.
      # Initially, it must match the UI default, "yast2"
      @screenshot_name = "yast2"

      # Screenshot names overriden by nested SetScreenShotName calls
      @screenshot_name_stack = []

      # Handling of relnotes button when creating a wizard over existing one
      # Cannot be handled by libyui for NCurses
      @relnotes_button_label = ""
      @relnotes_button_id = ""

      # Current icon name to set.
      @icon_name = DEFAULT_ICON_NAME
    end

    def haveFancyUI
      if @have_fancy_ui_cache.nil?
        ui_info = UI.GetDisplayInfo

        @have_fancy_ui_cache = UI.HasSpecialWidget(:Wizard) == true &&
          Ops.greater_or_equal(Ops.get_integer(ui_info, "Depth", 0), 15) &&
          Ops.greater_or_equal(Ops.get_integer(ui_info, "DefaultWidth", 0), 800) &&
          # some netbooks use such a strange resolution (fate#306298)
          Ops.greater_or_equal(
            Ops.get_integer(ui_info, "DefaultHeight", 0),
            576
          )

        # have_fancy_ui_cache = false;

        UI.SetFunctionKeys(Label.DefaultFunctionKeyMap)
      end

      @have_fancy_ui_cache
    end

    # Returns a button box with buttons "Back", "Abort", "Next"
    # @return a widget tree
    #
    def BackAbortNextButtonBox
      HBox(
        HWeight(
          1,
          ReplacePoint(
            Id(:rep_help),
            PushButton(Id(:help), Opt(:key_F1, :helpButton), Label.HelpButton)
          )
        ),
        HStretch(),
        HWeight(
          1,
          ReplacePoint(
            Id(:rep_back),
            PushButton(Id(:back), Opt(:key_F8), Label.BackButton)
          )
        ),
        HStretch(),
        ReplacePoint(
          Id(:rep_abort),
          PushButton(Id(:abort), Opt(:key_F9), Label.AbortButton)
        ),
        HStretch(),
        HWeight(
          1,
          ReplacePoint(
            Id(:rep_next),
            PushButton(Id(:next), Opt(:key_F10, :default), Label.NextButton)
          )
        )
      )
    end

    # Returns a button box with buttons "Back", "Abort Installation", "Next"
    # @return a widget tree
    #
    def BackAbortInstallationNextButtonBox
      HBox(
        HWeight(
          1,
          ReplacePoint(
            Id(:rep_help),
            PushButton(Id(:help), Opt(:key_F1, :helpButton), Label.HelpButton)
          )
        ),
        HStretch(),
        HWeight(
          1,
          ReplacePoint(
            Id(:rep_back),
            PushButton(Id(:back), Opt(:key_F8), Label.BackButton)
          )
        ),
        HStretch(),
        ReplacePoint(
          Id(:rep_abort),
          PushButton(Id(:abort), Opt(:key_F9), Label.AbortInstallationButton)
        ),
        HStretch(),
        HWeight(
          1,
          ReplacePoint(
            Id(:rep_next),
            PushButton(Id(:next), Opt(:key_F10, :default), Label.NextButton)
          )
        )
      )
    end

    # Returns a button box with buttons "Back", "Next"
    # @return a widget tree
    #
    def BackNextButtonBox
      HBox(
        HWeight(
          1,
          ReplacePoint(
            Id(:rep_back),
            PushButton(Id(:back), Opt(:key_F8), Label.BackButton)
          )
        ),
        HStretch(),
        HWeight(
          1,
          ReplacePoint(
            Id(:rep_next),
            PushButton(Id(:next), Opt(:key_F10, :default), Label.NextButton)
          )
        )
      )
    end

    # Returns a button box with buttons "Cancel", "Accept"
    # @return a widget tree
    #
    def CancelAcceptButtonBox
      ButtonBox(
        PushButton(Id(:cancel), Opt(:key_F9, :cancelButton), Label.CancelButton),
        PushButton(
          Id(:accept),
          Opt(:key_F10, :default, :okButton),
          Label.AcceptButton
        )
      )
    end

    # Returns a button box with buttons "Cancel", "OK"
    # @return a widget tree
    #
    def CancelOKButtonBox
      ButtonBox(
        PushButton(Id(:cancel), Opt(:key_F9, :cancelButton), Label.CancelButton),
        PushButton(Id(:ok), Opt(:key_F10, :default, :okButton), Label.OKButton)
      )
    end

    # Returns a button box with buttons "Abort", "Accept"
    # @return a widget tree
    #
    def AbortAcceptButtonBox
      HBox(
        HWeight(1, ReplacePoint(Id(:back_rep), Empty())), # Layout trick to make sure the center button is centered
        HStretch(),
        HWeight(
          1,
          ReplacePoint(
            Id(:rep_abort), # Make sure HideAbortButton() works (bnc #444176)
            PushButton(Id(:abort), Opt(:key_F9), Label.AbortButton)
          )
        ),
        HStretch(),
        HWeight(
          1,
          PushButton(Id(:accept), Opt(:key_F10, :default), Label.AcceptButton)
        )
      )
    end

    # Returns a button box with buttons "Abort Installation", "Accept"
    # @return a widget tree
    #
    def AbortInstallationAcceptButtonBox
      ButtonBox(
        PushButton(
          Id(:abort),
          Opt(:key_F9, :cancelButton),
          Label.AbortInstallationButton
        ),
        PushButton(
          Id(:accept),
          Opt(:key_F10, :okButton, :default),
          Label.AcceptButton
        )
      )
    end

    # Returns a button box with buttons "Abort", "Apply", "Finish"
    # @return a widget tree
    #
    def AbortApplyFinishButtonBox
      ButtonBox(
        PushButton(Id(:abort, :cancelButton, :key_F9), Label.AbortButton),
        # button text
        PushButton(Id(:apply, :applyButton), _("&Apply")),
        PushButton(Id(:finish, :okButton, :key_F10), Label.FinishButton)
      )
    end

    # Create a Generic Dialog
    #
    #
    # Returns a term describing a generic wizard dialog with a configurable
    # button box.
    #
    # @note This is a stable API function
    #
    # @param [Yast::Term] button_box term that contains a `HBox() with buttons in it
    # @return  [Yast::Term] term describing the dialog.
    #
    def GenericDialog(button_box)
      button_box = deep_copy(button_box)
      VBox(
        Id(:WizardDialog),
        ReplacePoint(Id(:topmenu), Empty()),
        VWeight(
          1, # Layout trick: Lower layout priority with weight
          HBox(
            HSpacing(1),
            VBox(
              VSpacing(0.2),
              HBox(
                # translators: dialog title to appear before any content is initialized
                Heading(Id(:title), Opt(:hstretch), _("Initializing ...")),
                HStretch(),
                ReplacePoint(Id(:relnotes_rp), Empty())
              ),
              VWeight(
                1, # Layout trick: Lower layout priority with weight
                HVCenter(Opt(:hvstretch), ReplacePoint(Id(:contents), Empty()))
              )
            ),
            HSpacing(1)
          )
        ),
        ReplacePoint(Id(:rep_button_box), button_box),
        VSpacing(0.2)
      )
    end

    # Create a Generic Tree Dialog
    #
    #
    # Returns a term describing a wizard dialog with left menu tree,
    # right contents and a configurable button box.
    #
    #
    # @note This is a stable API function
    #
    # @param [Yast::Term] button_box term that contains a `HBox() with buttons in it
    # @return  [Yast::Term] term describing the dialog.
    #

    def GenericTreeDialog(button_box)
      button_box = deep_copy(button_box)
      VBox(
        Id(:WizardDialog),
        ReplacePoint(Id(:topmenu), Empty()),
        HBox(
          HSpacing(1),
          HWeight(
            30,
            ReplacePoint(
              Id(:helpSpace), # `RichText(`id(`HelpText), "")
              Empty()
            )
          ),
          HSpacing(1),
          HWeight(
            70,
            VBox(
              VSpacing(0.2),
              HBox(
                # translators: dialog title to appear before any content is initialized
                Heading(
                  Id(:title),
                  Opt(:hstretch),
                  _("YaST\nInitializing ...\n")
                ),
                HStretch()
              ),
              VWeight(
                1, # Layout trick: Lower layout priority with weight
                HVCenter(Opt(:hvstretch), ReplacePoint(Id(:contents), Empty()))
              )
            )
          ),
          HSpacing(1)
        ),
        ReplacePoint(Id(:rep_button_box), button_box),
        VSpacing(0.2)
      )
    end

    # Check if the topmost dialog is a wizard dialog
    # (i.e. has a widget with `id(`WizardDialog) )
    #
    # @return [Boolean] True if topmost dialog is a wizard dialog, false otherwise
    #
    def IsWizardDialog
      UI.WidgetExists(Id(:WizardDialog)) == true ||
        UI.WidgetExists(:wizard) == true
    end

    # Open a popup dialog that displays a help text (rich text format).
    #
    # @note This is a stable API function
    #
    # @param [String] help_text the text to display
    #
    def ShowHelp(help_text)
      Popup.LongText(
        # Heading for help popup window
        _("Help"),
        RichText(help_text),
        50,
        20
      )

      nil
    end

    # Returns a standard wizard dialog with buttons "Next", "Back", "Abort".
    #
    # @note This is a stable API function
    #
    # @return [Yast::Term] describing the dialog.
    #
    def NextBackDialog
      GenericDialog(BackAbortNextButtonBox())
    end

    # Returns a standard wizard dialog with buttons "Cancel", "Accept"
    #
    # @note This is a stable API function
    #
    # @return [Yast::Term] describing the dialog.
    #
    def AcceptDialog
      GenericDialog(CancelAcceptButtonBox())
    end

    # Returns a standard wizard dialog with buttons "Cancel", "OK"
    #
    # @note This is a stable API function
    #
    # @return [Yast::Term] describing the dialog.
    #
    def OKDialog
      GenericDialog(CancelOKButtonBox())
    end

    # Open any wizard dialog.
    #
    # @note This is a stable API function
    #
    # @param [Yast::Term] dialog  a wizard dialog, e.g. Wizard::GenericDialog()
    #
    def OpenDialog(dialog)
      dialog = deep_copy(dialog)

      set_icon
      UI.OpenDialog(Opt(:wizardDialog), dialog)
      ShowReleaseNotesButton(@relnotes_button_label, @relnotes_button_id) if !@relnotes_button_id.empty?

      nil
    end

    # Open a dialog with buttons "Next", "Back", "Abort"
    # and set the keyboard focus to "Next".
    #
    def OpenNextBackDialog
      if haveFancyUI
        open_wizard_dialog(
          :back,
          Label.BackButton,
          :abort,
          Label.AbortButton,
          :next,
          Label.NextButton
        )
      else
        OpenDialog(NextBackDialog())
        UI.SetFocus(Id(:next))
      end

      nil
    end

    # Open a dialog with "Accept", "Cancel"
    # and set the keyboard focus to "Accept".
    #
    def OpenAcceptDialog
      if haveFancyUI
        open_wizard_dialog(
          :no_back_button,
          "",
          :cancel,
          Label.CancelButton,
          :accept,
          Label.AcceptButton
        )

        # Don't let sloppy calls to Wizard::SetContents() disable this button by accident
        UI.WizardCommand(term(:ProtectNextButton, true))
      else
        OpenDialog(AcceptDialog())
        UI.SetFocus(Id(:accept))
      end

      nil
    end

    # Open a dialog with "OK", "Cancel"
    # and set the keyboard focus to "OK".
    #
    def OpenOKDialog
      if haveFancyUI
        open_wizard_dialog(
          :no_back_button,
          "",
          :cancel,
          Label.CancelButton,
          :ok,
          Label.OKButton
        )

        # Don't let sloppy calls to Wizard::SetContents() disable this button by accident
        UI.WizardCommand(term(:ProtectNextButton, true))
      else
        OpenDialog(OKDialog())
        UI.SetFocus(Id(:ok))
      end

      nil
    end

    # Open a dialog with "Accept", "Cancel"
    # and set the keyboard focus to "Accept".
    #
    def OpenAbortApplyFinishDialog
      if haveFancyUI
        open_wizard_dialog(
          :apply,
          _("&Apply"),
          :abort,
          Label.AbortButton,
          :finish,
          Label.FinishButton
        )
      else
        OpenDialog(GenericDialog(AbortApplyFinishButtonBox()))
        UI.SetFocus(Id(:finish))
      end

      nil
    end

    # Open a dialog with "Accept", "Cancel" that will also accept workflow steps.
    #
    def OpenAcceptStepsDialog
      if haveFancyUI
        open_wizard_dialog(
          Opt(:stepsEnabled),
          :no_back_button,
          "",
          :cancel,
          Label.CancelButton,
          :accept,
          Label.AcceptButton
        )

        # Don't let sloppy calls to Wizard::SetContents() disable this button by accident
        UI.WizardCommand(term(:ProtectNextButton, true))
      else
        OpenAcceptDialog()
      end

      nil
    end

    # Open a dialog with "Accept", "Cancel" that will also accept workflow steps.
    #
    def OpenAcceptAbortStepsDialog
      if haveFancyUI
        open_wizard_dialog(
          Opt(:stepsEnabled),
          :no_back_button,
          "",
          :abort,
          Label.AbortButton,
          :accept,
          Label.AcceptButton
        )

        # Don't let sloppy calls to Wizard::SetContents() disable this button by accident
        UI.WizardCommand(term(:ProtectNextButton, true))
      else
        OpenDialog(GenericDialog(AbortAcceptButtonBox()))
      end

      nil
    end

    # Open a dialog with "Back", "Next", "Abort" that will also accept workflow steps.
    #
    def OpenNextBackStepsDialog
      if haveFancyUI
        open_wizard_dialog(
          Opt(:stepsEnabled),
          :back,
          Label.BackButton,
          :abort,
          Label.AbortButton,
          :next,
          Label.NextButton
        )
      else
        OpenNextBackDialog()
      end

      nil
    end

    # Open a dialog with "Back", "Next", "Abort"
    # that has the title on the left, as wanted by
    # the installation visual design
    def OpenLeftTitleNextBackDialog
      if haveFancyUI
        open_wizard_dialog(
          Opt(:titleOnLeft),
          :back,
          Label.BackButton,
          :abort,
          Label.AbortButton,
          :next,
          Label.NextButton
        )
      else
        OpenNextBackDialog()
      end

      nil
    end

    # Open a new wizard according to the layout configuration
    #
    # @param layout [::UI::Wizards::Layout]
    def OpenWithLayout(layout)
      UI.SetProductLogo(layout.banner?)

      if layout.mode.steps?
        self.OpenNextBackStepsDialog
      elsif layout.mode.tree?
        self.OpenTreeNextBackDialog
      elsif layout.mode.title_on_left?
        self.OpenLeftTitleNextBackDialog
      elsif layout.mode.title_on_top?
        self.OpenNextBackDialog
      else
        raise "Unknown layout mode: #{layout}"
      end
    end

    # Open a wizard dialog with simple layout
    #
    # no graphics, no steps,
    # only a help widget buttons (by default "Back", "Abort", "Next").
    #
    # This is the only type of wizard dialog which still allows replacing
    # the help space - either already upon opening it or later with
    # Wizard::ReplaceCustomHelp().
    #
    # If help_space_contents is 'nil', the normal help widget will remain.
    # If button_box is 'nil', Wizard::BackAbortNextButtonBox() is used.
    #
    # @see #CloseDialog
    #
    # @param [Yast::Term] help_space_contents Help space contents
    # @param [Yast::Term] button_box Buttom Box
    # @return [void]
    #
    def OpenCustomDialog(help_space_contents, button_box)
      help_space_contents = deep_copy(help_space_contents)
      button_box = deep_copy(button_box)
      button_box = BackAbortNextButtonBox() if button_box.nil?

      set_icon
      UI.OpenDialog(Opt(:wizardDialog), GenericDialog(button_box))

      UI.ReplaceWidget(Id(:helpSpace), help_space_contents) if !help_space_contents.nil?

      nil
    end

    # Replace the help widget for dialogs opened with Wizard::OpenCustomDialog().
    # @param [Yast::Term] contents Replace custom help with supplied contents
    #
    def ReplaceCustomHelp(contents)
      contents = deep_copy(contents)
      if UI.WidgetExists(Id(:helpSpace))
        UI.ReplaceWidget(Id(:helpSpace), contents)
      else
        Builtins.y2error(
          "Wizard::ReplaceHelpSpace() works only for dialogs opened with Wizard::OpenSimpleDialog() !"
        )
      end

      nil
    end

    # Close a wizard dialog.
    #
    # @note This is a stable API function
    #
    def CloseDialog
      if IsWizardDialog()
        UI.CloseDialog
      else
        Builtins.y2error(
          "Wizard::CloseDialog(): Topmost dialog is not a wizard dialog!"
        )
      end

      nil
    end

    # Substitute for UI::UserInput
    #
    # This function transparently handles different variations of the wizard
    # layout. Returns `next if `next or `accept were clicked, `back if `back
    # or `cancel were clicked. Simply replace
    #    ret = UI::UserInput()
    # with
    #    ret = Wizard::UserInput()
    #
    # @return (maybe normalized) widget ID
    #
    def UserInput
      input = UI.UserInput

      return :next if input == :accept
      return :back if input == :cancel

      deep_copy(input)
    end

    # Substitute for UI::TimeoutUserInput
    #
    # Analogical to Wizard::UserInput.
    #
    # @param [Fixnum] timeout_millisec
    #
    def TimeoutUserInput(timeout_millisec)
      input = UI.TimeoutUserInput(timeout_millisec)

      return :next if input == :accept
      return :back if input == :cancel

      deep_copy(input)
    end

    # Substitute for UI::WaitForEvent
    #
    # Analog to Wizard::UserInput.
    #
    def WaitForEvent
      input = UI.WaitForEvent

      Ops.set(input, "ID", :next) if Ops.get(input, "ID") == :accept
      Ops.set(input, "ID", :back) if Ops.get(input, "ID") == :cancel

      deep_copy(input)
    end

    # Substitute for UI::WaitForEvent with timeout
    #
    # Analog to Wizard::UserInput.
    #
    def TimeoutWaitForEvent(timeout_millisec)
      input = UI.WaitForEvent(timeout_millisec)

      Ops.set(input, "ID", :next) if Ops.get(input, "ID") == :accept
      Ops.set(input, "ID", :back) if Ops.get(input, "ID") == :cancel

      deep_copy(input)
    end

    # Set a new help text.
    # @param [String] help_text Help text
    # @example Wizard::SetHelpText("This is a help Text");
    #
    def SetHelpText(help_text)
      UI.ChangeWidget(Id(:WizardDialog), :HelpText, help_text) if UI.WizardCommand(term(:SetHelpText, help_text)) == false

      nil
    end

    # Replace the wizard help subwindow with a custom widget.
    #
    # @deprecated
    # @param [Yast::Term] contents Replace Help with contents
    #
    def ReplaceHelp(contents)
      contents = deep_copy(contents)
      if UI.WidgetExists(Id(:helpSpace))
        Builtins.y2warning("Wizard::ReplaceHelp() is deprecated!")
        UI.ReplaceWidget(Id(:helpSpace), contents)
      else
        Builtins.y2error(
          "Wizard::ReplaceHelp() is not supported by the new Qt wizard!"
        )
      end

      nil
    end

    # Restore the wizard help subwindow.
    # @param [String] help_text Help text
    #
    def RestoreHelp(help_text)
      SetHelpText(help_text)

      nil
    end

    # Create and open a typical installation wizard dialog.
    #
    # For backwards compatibility only - don't use this any more in new modules.
    #
    def CreateDialog
      # Set productname for help text
      @product_name = OSRelease.ReleaseName if @product_name == ""
      UI.SetProductName(@product_name)

      OpenNextBackDialog()

      nil
    end

    # Set the contents of a wizard dialog and define if to move focus to next button
    #
    # How the general framework for the installation wizard should
    # look like. This function creates and shows a dialog.
    #
    # @param [String] title Dialog Title
    # @param [Yast::Term] contents The Dialog contents
    # @param [String] help_text Help text
    # @param [Boolean] has_back Is the Back button enabled?
    # @param [Boolean] has_next Is the Next button enabled?
    # @param [Boolean] set_focus Should the focus be set to Next button?
    #
    def SetContentsFocus(title, contents, help_text, has_back, has_next, set_focus)
      contents = deep_copy(contents)
      if UI.WizardCommand(term(:SetDialogHeading, title)) == true
        UI.WizardCommand(term(:SetHelpText, help_text))
        UI.WizardCommand(term(:EnableNextButton, has_next))
        UI.WizardCommand(term(:EnableBackButton, has_back))
        UI.WizardCommand(term(:SetFocusToNextButton)) if set_focus
      else
        if UI.WidgetExists(Id(:next))
          UI.ChangeWidget(Id(:next), :Enabled, has_next)
          UI.SetFocus(Id(:next))
        end

        UI.ChangeWidget(Id(:back), :Enabled, has_back) if UI.WidgetExists(Id(:back))
        UI.ChangeWidget(Id(:abort), :Enabled, true) if UI.WidgetExists(Id(:abort))
        UI.ChangeWidget(Id(:title), :Value, title) if UI.WidgetExists(Id(:title))

        UI.SetFocus(Id(:accept)) if set_focus && UI.WidgetExists(Id(:accept))
      end

      SetHelpText(help_text)
      UI.ReplaceWidget(Id(:contents), contents)

      nil
    end

    # Set the contents of a wizard dialog
    #
    # How the general framework for the installation wizard should
    # look like. This function creates and shows a dialog.
    #
    # @note This is a stable API function
    #
    # @param [String] title Dialog Title
    # @param [Yast::Term] contents The Dialog contents
    # @param [String] help_text Help text
    # @param [Boolean] has_back Is the Back button enabled?
    # @param [Boolean] has_next Is the Next button enabled?
    # @see Example file doc/examples/wizard1.rb
    # ![screenshots/wizard1.png](../../doc/screenshots/wizard1.png)
    #
    def SetContents(title, contents, help_text, has_back, has_next)
      contents = deep_copy(contents)
      SetContentsFocus(title, contents, help_text, has_back, has_next, true)

      nil
    end

    # Clear the wizard contents.
    #
    # This may sound silly, but it gives much faster feedback to the
    # user if used properly: Whenever the user clicks "Next" or
    # "Back", call ClearContents() prior to any lengthy
    # operation -> the user notices instant response, even though he
    # may in fact still have to wait.
    #
    # @note This is a stable API function
    #
    def ClearContents
      SetContents("", Empty(), "", false, false)

      nil
    end

    # Set the dialog's "Next" button with a new label and a new ID
    #
    # @note This is a stable API function
    #
    # @param [Object] id Button ID
    # @param [String] label Button Label
    #
    def SetNextButton(id, label)
      id = deep_copy(id)
      if UI.WizardCommand(term(:SetNextButtonLabel, label)) == true
        UI.WizardCommand(term(:SetNextButtonID, id))
      elsif UI.WidgetExists(Id(:rep_next))
        UI.ReplaceWidget(
          Id(:rep_next),
          PushButton(Id(id), Opt(:key_F10, :default), label)
        )
      end

      nil
    end

    # Set the dialog's "Back" button with a new label and a new ID
    #
    # @note This is a stable API function
    #
    # @param [Object] id Button ID
    # @param [String] label Button Label
    #
    def SetBackButton(id, label)
      id = deep_copy(id)
      if UI.WizardCommand(term(:SetBackButtonLabel, label)) == true
        UI.WizardCommand(term(:SetBackButtonID, id))
      elsif UI.WidgetExists(Id(:rep_back))
        UI.ReplaceWidget(
          Id(:rep_back),
          PushButton(Id(id), Opt(:key_F8), label)
        )
      end

      nil
    end

    # Set the dialog's "Abort" button with a new label and a new ID
    #
    # @note This is a stable API function
    #
    # @param [Object] id Button ID
    # @param [String] label Button Label
    #
    def SetAbortButton(id, label)
      id = deep_copy(id)

      if UI.WizardCommand(term(:SetAbortButtonLabel, label)) == true
        UI.WizardCommand(term(:SetAbortButtonID, id))
      elsif UI.WidgetExists(Id(:rep_abort))
        UI.ReplaceWidget(
          Id(:rep_abort),
          PushButton(Id(id), Opt(:key_F9), label)
        )
      end

      nil
    end

    # Hide the Wizard's "Next" button.
    # Restore it later with RestoreNextButton():
    #
    # @see #RestoreNextButton
    # @note This is a stable API function
    #
    def HideNextButton
      UI.ReplaceWidget(Id(:rep_next), Empty()) if UI.WizardCommand(term(:SetNextButtonLabel, "")) == false && UI.WidgetExists(Id(:rep_next))

      nil
    end

    # Hide the Wizard's "Back" button.
    # Restore it later with RestoreBackButton():
    #
    # @see #RestoreBackButton
    # @note This is a stable API function
    #
    def HideBackButton
      UI.ReplaceWidget(Id(:rep_back), Empty()) if UI.WizardCommand(term(:SetBackButtonLabel, "")) == false && UI.WidgetExists(Id(:rep_back))

      nil
    end

    # Overview Dialog
    # http://en.opensuse.org/YaST/Style_Guide#Single_Configuration.2FOverview.2FEdit_Dialog
    # dialog with Cancel and OK buttons (cancel has function as abort)
    #
    def OpenCancelOKDialog
      if haveFancyUI
        open_wizard_dialog(
          :back,
          Label.BackButton,
          :abort,
          Label.CancelButton,
          :next,
          Label.OKButton
        )
        HideBackButton()
      else
        OpenDialog(NextBackDialog())
        UI.SetFocus(Id(:next))
      end

      nil
    end

    # Hide the Wizard's "Abort" button.
    # Restore it later with RestoreAbortButton():
    #
    # @see #RestoreAbortButton
    # @note This is a stable API function
    #
    def HideAbortButton
      if UI.WizardCommand(term(:SetAbortButtonLabel, "")) == false
        if UI.WidgetExists(Id(:rep_abort))
          UI.ReplaceWidget(Id(:rep_abort), Empty())
        elsif UI.WidgetExists(Id(:cancel))
          UI.ReplaceWidget(Id(:cancel), Empty())
        end
      end

      nil
    end

    # Restore the wizard 'back' button.
    #
    # @see #HideBackButton
    # @note This is a stable API function
    #
    def RestoreBackButton
      SetBackButton(:back, Label.BackButton)

      nil
    end

    # Restore the wizard 'next' button.
    #
    # @see #HideNextButton
    # @note This is a stable API function
    #
    def RestoreNextButton
      SetNextButton(:next, Label.NextButton)

      nil
    end

    # Restore the wizard 'abort' button.
    #
    # @see #HideAbortButton
    # @note This is a stable API function
    #
    def RestoreAbortButton
      SetAbortButton(:abort, Label.AbortButton)

      nil
    end

    # Set contents and Buttons of wizard dialog
    #
    # Additionally set its title, help_text and buttons labels. Enables both back and next button.
    #
    # @params
    #
    # @param [String] title title of window
    # @param [Yast::Term] contents contents of dialog
    # @param [String] help_text help text
    # @param [String] back_label label of back button
    # @param [String] next_label label of next button
    #
    def SetContentsButtons(title, contents, help_text, back_label, next_label)
      contents = deep_copy(contents)
      UI.PostponeShortcutCheck

      RestoreBackButton()
      RestoreNextButton()

      if UI.WizardCommand(term(:SetBackButtonLabel, back_label)) == true
        UI.WizardCommand(term(:SetNextButtonLabel, next_label))
      else
        # Set button labels first to avoid geometry problems: SetContents()
        # calls ReplaceWidget() wich triggers a re-layout.

        UI.ChangeWidget(Id(:back), :Label, back_label) if UI.WidgetExists(Id(:back))
        UI.ChangeWidget(Id(:next), :Label, next_label) if UI.WidgetExists(Id(:next))
      end

      SetContents(title, contents, help_text, true, true)
      SetHelpText(help_text)
      UI.CheckShortcuts

      nil
    end

    # Sets the dialog title shown in the window manager's title bar.
    #
    # @param [String] title_text title of the dialog
    #
    # @example
    #  SetDialogTitle ("DNS Server Configuration");
    #
    def SetDialogTitle(title_text)
      # backward compatibility with showing just YaST2 in qt
      # see bsc#1033161 comment#4
      UI.SetApplicationTitle("YaST2") if haveFancyUI

      UI.WizardCommand(term(:SetDialogTitle, title_text))

      nil
    end

    # Sets the wizard 'title' icon to the specified icon from the standard icon
    # directory.
    #
    # @note Deprecated. Do nothing.
    #
    # @param [String] icon_name name (without path) of the new icon
    # @see #ClearTitleIcon
    #
    # @example
    #  SetTitleIcon ("yast-dns-server");
    #
    def SetTitleIcon(_icon_name)
      nil
    end

    # Clear the wizard 'title' icon, i.e. replace it with nothing
    #
    # @note Deprecated. Do nothing.
    # @see #SetTitleIcon
    #
    def ClearTitleIcon
      nil
    end

    # Sets the window title according to the name specified in a .desktop file got as parameter.
    # Desktop file is placed in a special directory (/usr/share/applications/YaST2).
    # Parameter file is realative to that directory without ".desktop" suffix.
    #
    # @param [String] file desktop file
    # @return [Boolean] true on success
    #
    # @example
    #  // Opens /usr/share/applications/YaST2/lan.desktop
    #  // Reads (localized) "name" entry from there
    #  // Sets the window title.
    #  SetDesktopTitle ("lan")
    def SetDesktopTitle(file)
      description = Desktop.ParseSingleDesktopFile(file)

      # fallback name for the dialog title
      name = Ops.get(description, "Name", _("Module"))

      Builtins.y2debug("Set dialog title: %1", name)
      SetDialogTitle(name)

      Builtins.haskey(description, "Name")
    end

    # Sets the icon specified in a .desktop file got as parameter.
    # Desktop file is placed in a special directory (/usr/share/applications/YaST2).
    # Parameter file is realative to that directory without ".desktop" suffix.
    # Warning: There are no desktop files in inst-sys. Use "SetTitleIcon" instead.
    #
    # @param [String] file Icon name
    # @return [Boolean] true on success
    #
    # @example
    #  // Opens /usr/share/applications/YaST2/lan.desktop
    #  // Reads "Icon" entry from there
    #  // Sets the icon.
    #  SetDesktopIcon ("lan")
    def SetDesktopIcon(file)
      description = Desktop.ParseSingleDesktopFile(file)
      return false unless description

      icon = description["Icon"].to_s
      return false if icon.empty?

      @icon_name = icon
      set_icon
    end

    # Convenience function to avoid 2 calls if application needs to set
    # both dialog title and icon from desktop file specified as parameter.
    # Desktop file is placed in a special directory (/usr/share/applications/YaST2).
    # Parameter file is realative to that directory without ".desktop" suffix.
    # Warning: There are no desktop files in inst-sys.
    #
    # @param [String] file desktop file name
    # @return [Boolean] true on success
    #
    # @example
    #  // Opens /usr/share/applications/YaST2/lan.desktop
    #  // Reads "Icon" and "Name" entries from there
    #  // Sets the icon, sets the dialog title
    #  SetDialogTitleAndIcon ("lan")
    def SetDesktopTitleAndIcon(file)
      description = Desktop.ParseSingleDesktopFile(file)

      # fallback name for the dialog title
      name = Ops.get(description, "Name", _("Module"))

      Builtins.y2debug("Set dialog title: %1", name)
      SetDialogTitle(name)
      SetDesktopIcon(file)

      Builtins.haskey(description, "Name")
    end

    # PRIVATE - Replace the entire Wizard button box with a new one.
    # @param [Yast::Term] button_box Button Box term
    # @return [void]
    #
    def ReplaceButtonBox(button_box)
      button_box = deep_copy(button_box)
      UI.ReplaceWidget(Id(:rep_button_box), button_box)

      nil
    end

    # Enable the wizard's "Abort" button.
    #
    # @see #DisableAbortButton
    # @note This is a stable API function
    #
    def EnableAbortButton
      UI.ChangeWidget(Id(:abort), :Enabled, true) if UI.WizardCommand(term(:EnableAbortButton, true)) == false

      nil
    end

    # Disable the wizard's "Abort" button.
    #
    # @see #EnableAbortButton
    # @note This is a stable API function
    #
    def DisableAbortButton
      UI.ChangeWidget(Id(:abort), :Enabled, false) if UI.WizardCommand(term(:EnableAbortButton, false)) == false

      nil
    end

    # Disable the wizard's "Next" (or "Accept") button.
    #
    # @see #EnableNextButton
    # @note This is a stable API function
    #
    def DisableNextButton
      if UI.WizardCommand(term(:EnableNextButton, false)) == false
        if UI.WidgetExists(Id(:next))
          UI.ChangeWidget(Id(:next), :Enabled, false)
        elsif UI.WidgetExists(Id(:accept))
          UI.ChangeWidget(Id(:accept), :Enabled, false)
        else
          Builtins.y2error(-1, "Neither `next nor `accept widgets exist")
        end
      end

      nil
    end

    # Enable the wizard's "Next" (or "Accept") button.
    #
    # @see #DisableNextButton
    # @note This is a stable API function
    #
    def EnableNextButton
      if UI.WizardCommand(term(:EnableNextButton, true)) == false
        if UI.WidgetExists(Id(:next))
          UI.ChangeWidget(Id(:next), :Enabled, true)
        else
          UI.ChangeWidget(Id(:accept), :Enabled, true)
        end
      end

      nil
    end

    # Disable the wizard's "Back" button.
    #
    # @see #EnableBackButton
    # @note This is a stable API function
    #
    def DisableBackButton
      UI.ChangeWidget(Id(:back), :Enabled, false) if UI.WizardCommand(term(:EnableBackButton, false)) == false

      nil
    end

    # Enable the wizard's "Back" button.
    #
    # @see #DisableBackButton
    # @note This is a stable API function
    #
    def EnableBackButton
      UI.ChangeWidget(Id(:back), :Enabled, true) if UI.WizardCommand(term(:EnableBackButton, true)) == false

      nil
    end

    # Disable the wizard's "Cancel" button.
    #
    # @see #EnableCancelButton
    # @note This is a stable API function
    #
    def DisableCancelButton
      UI.ChangeWidget(Id(:cancel), :Enabled, false) if UI.WizardCommand(term(:EnableCancelButton, false)) == false

      nil
    end

    # Enable the wizard's "Cancel" button.
    #
    # @see #DisableCancelButton
    # @note This is a stable API function
    #
    def EnableCancelButton
      UI.ChangeWidget(Id(:cancel), :Enabled, true) if UI.WizardCommand(term(:EnableCancelButton, true)) == false

      nil
    end

    # Returns whether the `Wizard widget is available.
    #
    # @see bnc #367213.
    # @return [Boolean] available
    def HasWidgetWizard
      if !UI.HasSpecialWidget(:Wizard)
        Builtins.y2milestone("no Wizard available")
        return false
      end

      true
    end

    # Show a "Release Notes" button with the specified label and ID if there is a "steps" panel
    #
    def ShowReleaseNotesButton(label, id)
      # has wizard? continue
      #   otherwise use dedicated ReplacePoint or reuse the back button
      # show-releasenotes-button failed? continue
      #   use dedicated ReplacePoint or reuse the back button
      if HasWidgetWizard() == false ||
          UI.WizardCommand(term(:ShowReleaseNotesButton, label, id)) == false
        @relnotes_button_label = label
        @relnotes_button_id = id
        if UI.WidgetExists(Id(:relnotes_rp))
          UI.ReplaceWidget(Id(:relnotes_rp), PushButton(Id(id), Opt(:relNotesButton), label))
        # Reuse Back button
        # TODO: can this situation happen
        elsif UI.WidgetExists(Id(:back_rep))
          UI.ReplaceWidget(Id(:back_rep), PushButton(Id(id), label))
        else
          Builtins.y2warning("Widget `back_rep does not exist")
        end
      end

      nil
    end

    # Hide the "Release Notes" button, if there is any
    #
    def HideReleaseNotesButton
      # has wizard? continue
      #    otherwise use dedicated ReplacePoint or reuse the back button
      # hide-releasenotes-button failed? continue
      #   reuse use dedicated ReplacePoint or the back button
      if HasWidgetWizard() == false ||
          UI.WizardCommand(term(:HideReleaseNotesButton)) == false
        @relnotes_button_label = ""
        @relnotes_button_id = ""
        if UI.WidgetExists(Id(:relnotes_rp))
          UI.ReplaceWidget(Id(:relnotes_rp), Empty())
        elsif UI.WidgetExists(Id(:back_rep))
          UI.ReplaceWidget(Id(:back_rep), Empty())
        end
      end

      nil
    end

    # Retranslate the wizard buttons.
    #
    # This will revert button labels and IDs
    # to the defaults that were used upon Wizard::CreateDialog(),
    # Wizard::OpenNextBackDialog(), or Wizard::OpenAcceptDialog().
    #
    def RetranslateButtons
      textdomain "base" # Reload translations
      if UI.WidgetExists(Id(:WizardDialog)) == true # NCurses wizard
        UI.ChangeWidget(Id(:help), :Label, Label.HelpButton) if UI.WidgetExists(Id(:help))
        ReplaceButtonBox(
          if UI.WidgetExists(Id(:accept))
            AbortAcceptButtonBox()
          else
            BackAbortNextButtonBox()
          end
        )
      else # Qt wizard
        UI.WizardCommand(term(:RetranslateInternalButtons))

        if UI.WidgetExists(:accept)
          UI.WizardCommand(term(:SetBackButtonLabel, ""))
          UI.WizardCommand(term(:SetAbortButtonLabel, Label.AbortButton))
          UI.WizardCommand(term(:SetNextButtonLabel, Label.AcceptButton))
        else
          UI.WizardCommand(term(:SetBackButtonLabel, Label.BackButton))
          UI.WizardCommand(term(:SetAbortButtonLabel, Label.AbortButton))
          UI.WizardCommand(term(:SetNextButtonLabel, Label.NextButton))
        end
      end

      nil
    end

    # Set the keyboard focus to the wizard's "Next" (or "Accept") button.
    #
    # @note This is a stable API function
    #
    def SetFocusToNextButton
      if UI.WizardCommand(term(:SetFocusToNextButton)) == false
        UI.SetFocus(UI.WidgetExists(Id(:next)) ? Id(:next) : Id(:accept))
      end

      nil
    end

    # Set the keyboard focus to the wizard's "Back" (or "Cancel") button.
    #
    # @note This is a stable API function
    #
    def SetFocusToBackButton
      if UI.WizardCommand(term(:SetFocusToBackButton)) == false
        UI.SetFocus(UI.WidgetExists(Id(:back)) ? Id(:back) : Id(:cancel))
      end

      nil
    end

    # Set a name for the current dialog:
    #
    # Declare a name for the current dialog to ease making screenshots.
    # By convention, the name is
    # `{rpm-name-without-yast2}-{sorting-prefix}-{description}`
    # The calls may be nested.
    # @param s eg. "mail-1-conntype"
    # @see #RestoreScreenShotName
    def SetScreenShotName(name)
      @screenshot_name_stack = Builtins.prepend(
        @screenshot_name_stack,
        @screenshot_name
      )
      @screenshot_name = name

      nil
    end

    # Restore the screenshot name.
    #
    # If it does not match a SetScreenShotName, "yast2" is used
    # and a y2error logged.
    def RestoreScreenShotName
      @screenshot_name = Ops.get(@screenshot_name_stack, 0)
      if @screenshot_name.nil?
        @screenshot_name = "yast2"
        Builtins.y2error(1, "No screenshot name to restore!")
      else
        @screenshot_name_stack = Builtins.remove(@screenshot_name_stack, 0)
      end

      nil
    end

    #
    # Tree & Menu Wizard functions
    #

    # Open a Tree  dialog with buttons "Next", "Back", "Abort"
    # and set the keyboard focus to "Next".
    #
    def OpenTreeNextBackDialog
      if haveFancyUI
        open_wizard_dialog(
          Opt(:treeEnabled),
          :back,
          Label.BackButton,
          :abort,
          Label.AbortButton,
          :next,
          Label.NextButton
        )
      else
        OpenDialog(GenericTreeDialog(BackAbortNextButtonBox()))
        UI.SetFocus(Id(:next))
      end

      nil
    end

    # Create and open a Tree wizard dialog.
    #
    # For backwards compatibility only - don't use this any more in new modules.
    #
    def CreateTreeDialog
      OpenTreeNextBackDialog()
      nil
    end

    # Add Tree Item to tree enabled Wizard
    # @param [Array<Hash>] Tree Tree Data
    # @param [String] parent Parent of this item
    # @param [String] title Item Title
    # @param [String] id Item ID
    # @return [Array<Hash>] Updated Tree Data
    #
    def AddTreeItem(tree, parent, title, id)
      tree = deep_copy(tree)
      if haveFancyUI
        UI.WizardCommand(term(:AddTreeItem, parent, title, id))
      else
        tree = Builtins.add(
          tree,
          "parent" => parent, "title" => title, "id" => id
        )
      end
      deep_copy(tree)
    end

    # Create the Tree Items
    # @param [Array<Hash>] Tree Tree data
    # @param [String] parent Parent of current Item
    # @return [Array] Tree Items
    #
    def CreateTreeInternal(tree, parent)
      tree = deep_copy(tree)
      m = Builtins.filter(tree) do |c|
        Ops.get_string(c, "parent", "") == parent
      end
      ccbak = nil # #38596, broken recursion for iterators
      mm = Builtins.maplist(m) do |cc|
        tree_entry = Ops.get_string(cc, "id", "")
        ccbak = deep_copy(cc)
        items = CreateTreeInternal(tree, tree_entry)
        cc = deep_copy(ccbak)
        if Ops.greater_than(Builtins.size(items), 0)
          next Item(
            Id(Ops.get_string(cc, "id", "")),
            Ops.get_string(cc, "title", ""),
            items
          )
        else
          next Item(
            Id(Ops.get_string(cc, "id", "")),
            Ops.get_string(cc, "title", "")
          )
        end
      end
      Builtins.y2debug("items: %1", mm)
      deep_copy(mm)
    end

    # Query Tree Item
    # @return Tree Item
    def QueryTreeItem
      if haveFancyUI
        Convert.to_string(UI.QueryWidget(Id(:wizard), :CurrentItem))
      else
        Convert.to_string(UI.QueryWidget(Id(:wizardTree), :CurrentItem))
      end
    end

    # Create the tree in the dialog, replaces helpspace with new tree widget
    # @param [Array<Hash>] Tree Tree data
    # @param [String] title Tree title
    #
    def CreateTree(tree, title)
      tree = deep_copy(tree)
      if !haveFancyUI
        items = []
        Builtins.foreach(tree) do |i|
          if Ops.get_string(i, "parent", "") == ""
            items = Builtins.add(
              items,
              Item(
                Id(Ops.get_string(i, "id", "")),
                Ops.get_string(i, "title", ""),
                CreateTreeInternal(tree, Ops.get_string(i, "id", ""))
              )
            )
          end
        end
        Builtins.y2debug("tree items: %1", items)

        ReplaceCustomHelp(
          VBox(
            term(:Tree, Id(:wizardTree), Opt(:notify, :vstretch), title, items),
            VSpacing(1)
          )
        )
      end

      nil
    end

    # Select Tree item
    # @param [String] tree_item tree item
    def SelectTreeItem(tree_item)
      if haveFancyUI
        UI.WizardCommand(term(:SelectTreeItem, tree_item))
      else
        UI.ChangeWidget(Id(:wizardTree), :CurrentItem, tree_item)
      end

      nil
    end

    # Delete Tree items
    def DeleteTreeItems
      if haveFancyUI
        UI.WizardCommand(term(:DeleteTreeItems))
      else
        ReplaceCustomHelp(Empty())
      end

      nil
    end

    # Delete Menu items
    def DeleteMenus
      if haveFancyUI
        UI.WizardCommand(term(:DeleteMenus))
      else
        UI.ReplaceWidget(Id(:topmenu), Empty())
      end

      nil
    end

    # Add Menu
    # @param [Array<Hash>] Menu  Menu data
    # @param [String] title Menu Title
    # @param [String] id Menu ID
    # @return [Array<Hash>] Updated Menu Data
    #
    def AddMenu(menu, title, id)
      menu = deep_copy(menu)
      if haveFancyUI
        UI.WizardCommand(term(:AddMenu, title, id))
      else
        menu = Builtins.add(
          menu,
          "type" => "Menu", "title" => title, "id" => id
        )
      end
      deep_copy(menu)
    end

    # Add Sub Menu
    # @param [Array<Hash>] Menu Menu data
    # @param [String] parent_id Menu Parent
    # @param [String] title Menu Title
    # @param [String] id Menu ID
    # @return [Array<Hash>] Updated Menu Data
    #
    def AddSubMenu(menu, parent_id, title, id)
      menu = deep_copy(menu)
      if haveFancyUI
        UI.WizardCommand(term(:AddSubMenu, parent_id, title, id))
      else
        menu = Builtins.add(
          menu,
          "type"   => "SubMenu",
          "parent" => parent_id,
          "title"  => title,
          "id"     => id
        )
      end
      deep_copy(menu)
    end

    # Add Menu Entry
    # @param [Array<Hash>] Menu Menu data
    # @param [String] parent_id Menu Parent
    # @param [String] title Menu Title
    # @param [String] id Menu ID
    # @return [Array<Hash>] Updated Menu Data
    #
    def AddMenuEntry(menu, parent_id, title, id)
      menu = deep_copy(menu)
      if haveFancyUI
        UI.WizardCommand(term(:AddMenuEntry, parent_id, title, id))
      else
        menu = Builtins.add(
          menu,
          "type"   => "MenuEntry",
          "parent" => parent_id,
          "title"  => title,
          "id"     => id
        )
      end
      deep_copy(menu)
    end

    # Create the Menu Items
    # @param [Array<Hash>] Menu Menu data
    # @param [String] parent Menu Parent
    # @return [Array] Menu Items
    #
    def CreateMenuInternal(menu, parent)
      menu = deep_copy(menu)
      m = Builtins.filter(menu) do |c|
        Ops.get_string(c, "parent", "") == parent
      end

      mm = Builtins.maplist(m) do |cc|
        case Ops.get_string(cc, "type", "")
        when "MenuEntry"
          menu_entry = Ops.get_string(cc, "id", "")
          next Item(Id(menu_entry), Ops.get_string(cc, "title", ""))
        when "SubMenu"
          sub_menu = Ops.get_string(cc, "id", "")
          next term(
            :menu,
            Ops.get_string(cc, "title", ""),
            CreateMenuInternal(menu, sub_menu)
          )
        end
      end
      Builtins.y2debug("items: %1", mm)
      deep_copy(mm)
    end

    # Create the menu in the dialog
    # @param [Array<Hash>] Menu Menu data
    # @return [void]
    #
    def CreateMenu(menu)
      menu = deep_copy(menu)
      if !haveFancyUI
        menu_term = HBox()
        Builtins.foreach(menu) do |m|
          if Ops.get_string(m, "type", "") == "Menu"
            menu_items = CreateMenuInternal(menu, Ops.get_string(m, "id", ""))
            Builtins.y2debug("menu_items: %1", menu_items)
            menu_term = Builtins.add(
              menu_term,
              MenuButton(Ops.get_string(m, "title", ""), menu_items)
            )
          end
        end
        Builtins.y2milestone("menu: %1", menu_term)
        UI.ReplaceWidget(Id(:topmenu), Left(menu_term))
      end
      nil
    end

    # Set the product name for UI
    # @param [String] name the product name
    # @return [void]
    #
    def SetProductName(name)
      Builtins.y2milestone("Setting product name to '%1'", name)
      @product_name = name
      UI.SetProductName(@product_name)

      nil
    end

    publish function: :BackAbortNextButtonBox, type: "term ()"
    publish function: :BackAbortInstallationNextButtonBox, type: "term ()"
    publish function: :BackNextButtonBox, type: "term ()"
    publish function: :CancelAcceptButtonBox, type: "term ()"
    publish function: :CancelOKButtonBox, type: "term ()"
    publish function: :AbortAcceptButtonBox, type: "term ()"
    publish function: :AbortInstallationAcceptButtonBox, type: "term ()"
    publish function: :AbortApplyFinishButtonBox, type: "term ()"
    publish function: :GenericDialog, type: "term (term)"
    publish function: :GenericTreeDialog, type: "term (term)"
    publish function: :IsWizardDialog, type: "boolean ()"
    publish function: :ShowHelp, type: "void (string)"
    publish function: :NextBackDialog, type: "term ()"
    publish function: :AcceptDialog, type: "term ()"
    publish function: :OKDialog, type: "term ()"
    publish function: :OpenDialog, type: "void (term)"
    publish function: :OpenNextBackDialog, type: "void ()"
    publish function: :OpenAcceptDialog, type: "void ()"
    publish function: :OpenOKDialog, type: "void ()"
    publish function: :OpenAbortApplyFinishDialog, type: "void ()"
    publish function: :OpenAcceptStepsDialog, type: "void ()"
    publish function: :OpenAcceptAbortStepsDialog, type: "void ()"
    publish function: :OpenNextBackStepsDialog, type: "void ()"
    publish function: :OpenLeftTitleNextBackDialog, type: "void ()"
    publish function: :OpenCustomDialog, type: "void (term, term)"
    publish function: :ReplaceCustomHelp, type: "void (term)"
    publish function: :CloseDialog, type: "void ()"
    publish function: :UserInput, type: "any ()"
    publish function: :TimeoutUserInput, type: "any (integer)"
    publish function: :WaitForEvent, type: "map ()"
    publish function: :TimeoutWaitForEvent, type: "map (integer)"
    publish function: :SetHelpText, type: "void (string)"
    publish function: :ReplaceHelp, type: "void (term)"
    publish function: :RestoreHelp, type: "void (string)"
    publish function: :CreateDialog, type: "void ()"
    publish function: :SetContentsFocus, type: "void (string, term, string, boolean, boolean, boolean)"
    publish function: :SetContents, type: "void (string, term, string, boolean, boolean)"
    publish function: :ClearContents, type: "void ()"
    publish function: :SetNextButton, type: "void (any, string)"
    publish function: :SetBackButton, type: "void (any, string)"
    publish function: :SetAbortButton, type: "void (any, string)"
    publish function: :HideNextButton, type: "void ()"
    publish function: :HideBackButton, type: "void ()"
    publish function: :OpenCancelOKDialog, type: "void ()"
    publish function: :HideAbortButton, type: "void ()"
    publish function: :RestoreBackButton, type: "void ()"
    publish function: :RestoreNextButton, type: "void ()"
    publish function: :RestoreAbortButton, type: "void ()"
    publish function: :SetContentsButtons, type: "void (string, term, string, string, string)"
    publish function: :SetDialogTitle, type: "void (string)"
    publish function: :SetTitleIcon, type: "void (string)"
    publish function: :ClearTitleIcon, type: "void ()"
    publish function: :SetDesktopTitle, type: "boolean (string)"
    publish function: :SetDesktopIcon, type: "boolean (string)"
    publish function: :SetDesktopTitleAndIcon, type: "boolean (string)"
    publish function: :EnableAbortButton, type: "void ()"
    publish function: :DisableAbortButton, type: "void ()"
    publish function: :DisableNextButton, type: "void ()"
    publish function: :EnableNextButton, type: "void ()"
    publish function: :DisableBackButton, type: "void ()"
    publish function: :EnableBackButton, type: "void ()"
    publish function: :DisableCancelButton, type: "void ()"
    publish function: :EnableCancelButton, type: "void ()"
    publish function: :ShowReleaseNotesButton, type: "void (string, string)"
    publish function: :HideReleaseNotesButton, type: "void ()"
    publish function: :RetranslateButtons, type: "void ()"
    publish function: :SetFocusToNextButton, type: "void ()"
    publish function: :SetFocusToBackButton, type: "void ()"
    publish function: :SetScreenShotName, type: "void (string)"
    publish function: :RestoreScreenShotName, type: "void ()"
    publish function: :OpenTreeNextBackDialog, type: "void ()"
    publish function: :CreateTreeDialog, type: "void ()"
    publish function: :AddTreeItem, type: "list <map> (list <map>, string, string, string)"
    publish function: :QueryTreeItem, type: "string ()"
    publish function: :CreateTree, type: "void (list <map>, string)"
    publish function: :SelectTreeItem, type: "void (string)"
    publish function: :DeleteTreeItems, type: "void ()"
    publish function: :DeleteMenus, type: "void ()"
    publish function: :AddMenu, type: "list <map> (list <map>, string, string)"
    publish function: :AddSubMenu, type: "list <map> (list <map>, string, string, string)"
    publish function: :AddMenuEntry, type: "list <map> (list <map>, string, string, string)"
    publish function: :CreateMenu, type: "void (list <map>)"
    publish function: :SetProductName, type: "void (string)"

  protected

    # Sets the icon and opens a wizard dialog with the content specified as
    # arguments
    def open_wizard_dialog(*args)
      set_icon
      UI.OpenDialog(
        Opt(:wizardDialog),
        Wizard(*args)
      )
    end

    # Sets the application icon according to the value of @icon_name
    #
    # This should be called only immediately before opening a dialog; premature
    # UI calls can interfere with the CommandLine mode.
    #
    # @return [Boolean] true if the application icon was set; false otherwise
    def set_icon
      UI.SetApplicationIcon(@icon_name)
      true
    end
  end

  Wizard = WizardClass.new
  Wizard.main
end
