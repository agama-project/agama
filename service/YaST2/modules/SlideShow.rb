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
# Module:    SlideShow.ycp
#
# Purpose:    Slide show during installation
#
# Author:    Stefan Hundhammer <sh@suse.de>
#      Stanislav Visnovsky <visnov@suse.cz>
#
# $Id$
#
# Usage:
# This is a generic module for handling global progress bar with optional slideshow/release notes etc.
#
# Global progress
# ===============
# The basic idea is that the progress consists of "stages" - during a new install,
# there are 3: disk preparation, image deployment and package installation.
#
# Before the first client using the unified progress, the stages need to be set
# up, e.g. :
#
# list< map<string,any> > stages = [
#     $[
#     "name" : "disk",
#     "description": _("Preparing disks..."),
#     "value" : Mode::update() ? 0 : 120, // 2 minutes, who needs more? ;-)
#     "units" : `sec,
#     ],
#     $[
#     "name" : "images",
#     "description": _("Deploying Images..."),
#     "value" : ImageInstallation::TotalSize() / 1024, // kilobytes
#     "units" : `kb,
#     ],
#     $[
#     "name" : "packages",
#     "description": _("Installing Packages..."),
#     // here, we do a hack, because until images are deployed, we cannot
# determine how many
#     // packages will be really installed additionally
#     "value" : (PackageSlideShow::total_size_to_install -
# ImageInstallation::TotalSize()) / 1024 , // kilobytes
#     "units" : `kb,
#     ],
#   ];
#
#   SlideShow::Setup( stages );
#
# The function will calculate the partitioning of the unified progress based on
# estimate of a needed time. A stage can provide the estimate of time or an
# amount of data to be transferred (the constants used are based on assumption
# of 15 min install time and that the data are downloaded and written to disk).
# The logic is no rocket science as the only goal for a progress bar is to have
# it move somewhat regularly. Also, the function resets timers and other
# progress status information, including which parts are shown. See \ref SlideShow::Reset.
#
# A client using the new unified progress will do basically 2 things:
#
# 1) calls SlideShow::MoveToStage( stage-id )
# - this will move the global progress to a proper position for start of the
# stage and updates also the label ("description" entry in the map)
#
# 2) calls regularly SlideShow::StageProgress( new_percent, new_label )
# - new_percent is the progress inside of the current stage, the library will
# recompute this to get a global progress percents.
# - if new_label is nil, label is not updated.
#
# SlideShow dialogs
# =================
# // SlideShow language must be set before opening the dialog
# SlideShow::SetLanguage( Language::language );
# SlideShow::OpenDialog ();
# ... <update stages, progress ...> ...
# SlideShow::CloseDialog ();
#
# More functionality
# ==================
# The SlideShow dialog contains the following functionality:
# - global progress (see above)
# - release notes viewer
require "yast"
require "yast2/system_time"

module Yast
  class SlideShowClass < Module
    include Yast::Logger

    def main
      Yast.import "UI"

      textdomain "base"

      Yast.import "Label"
      Yast.import "Stage"
      Yast.import "Wizard"
      Yast.import "Mode"
      Yast.import "Popup"
      Yast.import "Slides"

      @language = "en"
      @widgets_created = false
      @opened_own_wizard = false
      @user_abort = false

      # we need to remember the values for tab switching
      # these are the initial values
      @total_progress_label = _("Installing...")
      @total_progress_value = 0

      @relnotes = nil # forward declaration

      @_stages = {} # list of the configured stages
      @_current_stage = nil # current stage

      @_rn_tabs = {} # tabs with release notes
      @_relnotes = {} # texts with release notes, product -> text
      @_base_product = "" # base product for release notes ordering
    end

    # Set the flag that user requested abort of the installation
    # @param [Boolean] abort  new state of the abort requested flag (true = abort requested)
    def SetUserAbort(abort)
      @user_abort = abort

      nil
    end

    # Get the status of the flag that user requested abort of the installation
    # @return [Boolean]   state of the abort requested flag (true = abort requested)
    def GetUserAbort
      @user_abort
    end

    # Start the internal (global) timer.
    #
    # FIXME: Obsolete published method
    def StartTimer
      nil
    end

    # Reset the internal (global) timer.
    #
    # FIXME: Obsolete published method
    def ResetTimer
      nil
    end

    # Stop the internal (global) timer and account elapsed time.
    #
    # FIXME: Obsolete published method
    def StopTimer
      nil
    end

    # Check if currently the "Details" page is shown
    # @return true if showing details, false otherwise
    #
    def ShowingDetails
      @widgets_created && UI.WidgetExists(:detailsPage)
    end

    # Check if currently the "Slide Show" page is shown
    # @return true if showing details, false otherwise
    #
    # FIXME: Obsolete published method
    def ShowingSlide
      false
    end

    # Check if currently the "Release Notes" page is shown
    # @return true if showing details, false otherwise
    #
    def ShowingRelNotes(id)
      @widgets_created && UI.WidgetExists(id)
    end

    def ProductRelNotesID(product)
      ("rn_" + product).to_sym
    end

    # Restart the subprogress of the slideshow. This means the
    # label will be set to given text, value to 0.
    # @param [String] text  new label for the subprogress
    #
    # FIXME: Obsolete published method
    def SubProgressStart(text); end

    # Updates status of the sub-progress in slide show. The new value and label
    # will be set to values given as parametes. If a given parameter contains *nil*,
    # respective value/label will not be updated.
    #
    # @param [Fixnum] value  new value for the subprogress
    # @param [String] label  new label for the subprogress
    #
    # FIXME: Obsolete published method
    def SubProgress(value, label); end

    # Restart the global progress of the slideshow. This means the
    # label will be set to given text, value to 0.
    #
    # @param [String] text  new label for the global progress
    #
    # FIXME: Obsolete published method
    def GlobalProgressStart(text)
      UpdateGlobalProgress(0, text)
    end

    # Updates status of the global progress in slide show. The new value and label
    # will be set to values given as parametes. If a given parameter contains *nil*,
    # respective value/label will not be updated.
    #
    # @param [Fixnum] value  new value for the global progress
    # @param [String] label  new label for the global progress
    def UpdateGlobalProgress(value, label)
      value ||= @total_progress_value
      label ||= @total_progress_label

      if UI.WidgetExists(:progressTotal)
        if @total_progress_value != value
          @total_progress_value = value
          UI.ChangeWidget(:progressTotal, :Value, value)
        end

        if @total_progress_label != label
          @total_progress_label = label
          UI.ChangeWidget(:progressTotal, :Label, label)
        end
      else
        log.warn "progressTotal widget missing"
      end

      nil
    end

    # Return the description for the current stage.
    # @return [String]  localized string description
    def CurrentStageDescription
      Ops.get_locale(@_current_stage, "description", _("Installing..."))
    end

    # Move the global progress to the beginning of the given stage.
    # @param [String] stage_name  id of the stage to move to
    def MoveToStage(stage_name)
      if !Builtins.haskey(@_stages, stage_name)
        Builtins.y2error("Unknown progress stage \"%1\"", stage_name)
        return
      end

      @_current_stage = Ops.get(@_stages, stage_name)

      Builtins.y2milestone(
        "Moving to stage %1 (%2)",
        stage_name,
        Ops.get_integer(@_stages, [stage_name, "start"], 0)
      )
      # translators: default global progress bar label
      UpdateGlobalProgress(
        Ops.get_integer(@_stages, [stage_name, "start"], 0),
        Ops.get_locale(@_current_stage, "description", _("Installing..."))
      )

      nil
    end

    # Update the global progress according to the progress in the current stage.
    # The new value will be set to the per cent of the current stage according to  \param value.The
    # value must be lower that 100 (or it's corrected to 100).
    # If the \text is not nil, the label will be updated
    # to this text as well. Otherwise label will not change.
    #
    # @param [Fixnum] value  new value for the stage progress in per cents
    # @param [String] text  new label for the global progress
    def StageProgress(value, text)
      if Ops.greater_than(value, 100)
        Builtins.y2error("Stage progress value larger than expected: %1", value)
        value = 100
      end

      UpdateGlobalProgress(
        Ops.add(
          Ops.get_integer(@_current_stage, "start", 0),
          Ops.divide(
            Ops.multiply(value, Ops.get_integer(@_current_stage, "size", 1)),
            100
          )
        ),
        text
      )

      nil
    end

    # Sets the current global progress label.
    #
    # @param [String]  new label
    def SetGlobalProgressLabel(text)
      UpdateGlobalProgress(nil, text)

      nil
    end

    # Append message to the installation log.
    # @param [String] msg  message to be added, without trailing eoln
    def AppendMessageToInstLog(_msg)
      nil
    end

    # Check if the dialog is currently set up so the user could switch to the slide page.
    #
    def HaveSlideWidget
      UI.WidgetExists(:dumbTab)
    end

    # Check if the slide show is available. This must be called before trying
    # to access any slides; some late initialization is done here.
    #
    # FIXME: Obsolete
    def CheckForSlides
      nil
    end

    # Set the slide show text.
    # @param [String] text
    #
    # FIXME: Obsolete
    def SetSlideText(_text)
      nil
    end

    # Set the curent language. Must be called once during initialization.
    #
    def SetLanguage(new_language)
      @language = new_language
      Builtins.y2milestone("New SlideShow language: %1", @language)

      nil
    end

    # Create one single item for the CD statistics table
    #
    # FIXME: Obsolete published method
    def TableItem(id, col1, col2, col3, col4)
      Item(Id(id), col1, col2, col3, col4)
    end

    # Load a slide image + text.
    # @param [Fixnum] slide_no number of slide to load
    #
    # FIXME: Obsolete
    def LoadSlide(_slide_no)
      nil
    end

    # Check if the current slide needs to be changed and do that if
    # necessary.
    #
    # FIXME: Obsolete
    def ChangeSlideIfNecessary
      nil
    end

    # Widgets for the progress bar tab
    # @return  A term describing the widgets
    #
    def progress_widgets
      MarginBox(
        4, 1, # hor/vert
        VBox(
          product_name_widgets,
          VCenter(
            ProgressBar(
              Id(:progressTotal),
              @total_progress_label,
              100,
              @total_progress_value
            )
          )
        )
      )
    end

    # Widgets for the product name
    # @return A term describing the widgets
    def product_name_widgets
      text = product_name
      return Empty() if text.nil? || text.empty?

      MarginBox(
        0, 1, # hor/vert
        Left(
          Label(Id(:productName), text)
        )
      )
    end

    # Name of the base product that is or will be installed
    # @return [String,nil] Display name of the base product
    def product_name
      # Avoid expensive operation in the installed system where this will
      # always return 'nil' anyway.
      return nil if Mode.normal

      # lazy load product spec as it lives in packager and maybe is not available
      require "y2packager/product_spec"
      product = Y2Packager::ProductSpec.selected_base
      return nil if product.nil?

      product.display_name
    rescue LoadError
      log.info "product spec not available. Probably yast2-packager is missing"

      nil
    end

    # Construct widgets describing a page with the real slide show
    # (the RichText / HTML page)
    #
    # @return  A term describing the widgets
    #
    def SlidePageWidgets; end

    def DetailsTableWidget; end

    # Construct widgets for the "details" page
    #
    # @return  A term describing the widgets
    #
    def DetailsPageWidgets; end

    # Construct widgets for the "release notes" page
    #
    # @return  A term describing the widgets
    #
    def RelNotesPageWidgets(id); end

    # Switch from the 'details' view to the 'slide show' view.
    #
    # FIXME: Obsolete
    def SwitchToSlideView
      return if ShowingSlide()

      if UI.WidgetExists(:tabContents)
        UI.ChangeWidget(:dumbTab, :CurrentItem, :showSlide)
        UI.ReplaceWidget(:tabContents, SlidePageWidgets())
        # UpdateTotalProgress(false);    // FIXME: this breaks other stages!
      end

      nil
    end

    # Rebuild the details page.
    # FIXME: Obsolete
    def RebuildDetailsView
      nil
    end

    # Switch from the 'slide show' view to the 'details' view.
    #
    # FIXME: Obsolete
    def SwitchToDetailsView
      nil
    end

    # Switch to the 'release notes' view.
    #
    def SwitchToReleaseNotesView(id)
      return if ShowingRelNotes(id)

      if UI.WidgetExists(:tabContents)
        UI.ChangeWidget(:dumbTab, :CurrentItem, id)
        UI.ReplaceWidget(:tabContents, RelNotesPageWidgets(id))
        # UpdateTotalProgress(false);
      end

      nil
    end

    # Help text for the dialog
    def HelpText
      # Help text while software packages are being installed (displayed only in rare cases)
      _("<p>Packages are being installed.</p>") +
        _(
          "<P><B>Aborting Installation</B> Package installation can be aborted using the <B>Abort</B> button. However, the system then can be in an inconsistent or unusable state or it may not boot if the basic system component is not installed.</P>"
        )
    end

    # set the release notes for slide show
    # @param [map<string,string>] map product name -> release notes text
    # @param [string] base product name
    def SetReleaseNotes(relnotes, base_product)
      @_relnotes = relnotes
      @_base_product = base_product
    end

    def add_relnotes_for_product(product, relnotes, tabs)
      id = ProductRelNotesID product
      # Translators: Tab name, keep short, %s is product name, e.g. SLES
      tabs << Item(Id(id), _("%s Release Notes") % product)
      @_rn_tabs[id] = relnotes
    end

    # Rebuild the dialog. Useful if slides become available post-creating the dialog.
    #
    # @param [Boolean] show_release_notes release notes tab will be shown.
    def RebuildDialog(_show_release_notes = false)
      log.info "Rebuilding partitioning/RPM_installation progress"
      contents = progress_widgets

      Builtins.y2milestone("SlideShow contents: %1", contents)

      Wizard.SetContents(
        if Mode.update
          # Dialog heading - software packages are being upgraded
          _("Performing Upgrade")
        else
          # Dialog heading - software packages are being installed
          _("Performing Installation")
        end,
        contents,
        HelpText(),
        false, # no back button
        false  # no next button
      )

      @widgets_created = true

      nil
    end

    # Redrawing the complete slide show if needed.
    #
    def Redraw
      nil
    end

    # Open the slide show base dialog with empty work area (placeholder for
    # the image) and CD statistics.
    #
    def OpenSlideShowBaseDialog
      if !Wizard.IsWizardDialog # If there is no Wizard dialog open already, open one
        Wizard.OpenNextBackDialog
        @opened_own_wizard = true
      end

      UI.WizardCommand(term(:ProtectNextButton, false))
      Wizard.RestoreBackButton
      Wizard.RestoreAbortButton
      Wizard.EnableAbortButton
      Wizard.RestoreNextButton

      Wizard.SetContents(
        # Dialog heading while software packages are being installed
        _("Package Installation"),
        Empty(), # Wait until InitPkgData() is called from outside
        HelpText(),
        false,
        false
      ) # has_back, has_next

      RebuildDialog(true)

      # reset abort status
      SetUserAbort(false)

      nil
    end

    # Initialize generic data to default values
    def Reset
      nil
    end

    # Process (slide show) input (button press).
    #
    def HandleInput(button)
      SwitchToReleaseNotesView(button) if @_rn_tabs.key?(button) && !ShowingRelNotes(button)
      # NOTE: `abort is handled in SlideShowCallbacks::HandleInput()

      nil
    end

    # Check for user button presses and handle them. Generic handling to be used in the
    # progress handlers.
    #
    def GenericHandleInput
      button = UI.PollInput

      # in case of cancel ask user if he really wants to quit installation
      if [:abort, :cancel].include?(button)
        if Mode.normal
          SetUserAbort(
            Popup.AnyQuestion(
              Popup.NoHeadline,
              # popup yes-no
              _("Do you really want\nto quit the installation?"),
              Label.YesButton,
              Label.NoButton,
              :focus_no
            )
          )
        elsif Stage.initial
          SetUserAbort(Popup.ConfirmAbort(:unusable)) # Mode::update (), Stage::cont ()
        else
          SetUserAbort(Popup.ConfirmAbort(:incomplete))
        end

        AppendMessageToInstLog(_("Aborted")) if GetUserAbort()
      else
        HandleInput(button)
      end

      nil
    end

    # Open the slide show dialog.
    #
    def OpenDialog
      # call SlideShowCallbacks::InstallSlideShowCallbacks()
      WFM.call("wrapper_slideshow_callbacks", ["InstallSlideShowCallbacks"])

      OpenSlideShowBaseDialog()

      nil
    end

    # Close the slide show dialog.
    #
    def CloseDialog
      Wizard.CloseDialog if @opened_own_wizard

      # call SlideShowCallbacks::RemoveSlideShowCallbacks()
      WFM.call("wrapper_slideshow_callbacks", ["RemoveSlideShowCallbacks"])

      nil
    end

    def ShowTable
      nil
    end

    def HideTable
      nil
    end

    def UpdateTable(_items)
      nil
    end

    #  Prepare the stages for the global progressbar. Will compute the total estimate of time and
    #  partition the global 100% to given stages based on their estimates. Can compute out of
    #  time and size to download.
    #
    #  The stages description list example:
    #  [
    #      $[
    #    "name" : "disk",
    #    "description" : "Prepare disk...",
    #    "value" : 85,    // disk speed can be guessed by the storage, thus passing time
    #    "units" : `sec
    #       ],
    #      $[
    #    "name" : "images";
    #    "description" : "Deploying images...",
    #    "value" : 204800,  // amount of kb to be downloaded/installed
    #    "units" : `kb
    #       ],
    #  ]
    def Setup(stages)
      stages = deep_copy(stages)
      log.info "SlideShow stages: #{stages}"
      # initiliaze the generic counters
      Reset()

      # gather total amount of time need
      total_time = 0

      Builtins.foreach(stages) do |stage|
        total_time = if Ops.get_symbol(stage, "units", :sec) == :sec
          Ops.add(total_time, Ops.get_integer(stage, "value", 0)) # assume kilobytes
        else
          # assume 15 minutes for installation of openSUSE 11.0, giving 3495 as the constant for kb/s
          Ops.add(
            total_time,
            Ops.divide(Ops.get_integer(stage, "value", 0), 3495)
          )
        end
      end

      # avoid division by zero, set at least 1 second
      total_time = 1 if total_time == 0

      Builtins.y2milestone("Total estimated time: %1", total_time)

      start = 0 # value where the current stage starts

      @_stages = {} # prepare a new stages description

      total_size = 0
      # distribute the total time to stages as per cents
      Builtins.foreach(stages) do |stage|
        if Ops.get_symbol(stage, "units", :sec) == :sec
          Ops.set(
            stage,
            "size",
            Ops.divide(
              Ops.multiply(Ops.get_integer(stage, "value", 0), 100),
              total_time
            )
          )
          Ops.set(stage, "start", start)
        else
          # assume 15 minutes for installation of openSUSE 11.0, giving 3495 as the constant
          Ops.set(
            stage,
            "size",
            Ops.divide(
              Ops.divide(
                Ops.multiply(Ops.get_integer(stage, "value", 0), 100),
                3495
              ),
              total_time
            )
          )
          Ops.set(stage, "start", start)
          if Ops.greater_than(
            Ops.add(Ops.get_integer(stage, "size", 0), start),
            100
          )
            Ops.set(stage, "size", Ops.subtract(100, start))
          end
        end

        start = Ops.add(start, Ops.get_integer(stage, "size", 0))
        total_size += stage["size"]
        Ops.set(@_stages, Ops.get_string(stage, "name", ""), stage)
        # setup first stage
        @_current_stage = deep_copy(stage) if @_current_stage.nil?
      end

      # Because of using integers in the calculation above the sum of the sizes
      # might not be 100% due to rounding. Update the last stage so the
      # total installation progress is 100%.
      if total_size != 100
        log.info "Total global progress: #{total_size}%, adjusting to 100%..."

        # find the last stage and adjust it
        updated_stage_name = stages.last["name"]
        updated_stage = @_stages[updated_stage_name]

        new_size = 100 - total_size + updated_stage["size"]
        log.info "Updating '#{updated_stage_name}' stage size from " \
                 "#{updated_stage["size"]}% to #{new_size}%"

        updated_stage["size"] = new_size
        @_stages[updated_stage_name] = updated_stage
      end

      Builtins.y2milestone("Global progress bar: %1", @_stages)

      nil
    end

    # Returns the current setup defined by Setup().
    #
    # @return [Hash <String, Hash{String => Object>}] stages
    # @see #Setup()
    #
    # **Structure:**
    #
    #     $[ stage_name : $[ stage_setup ], ... ]
    def GetSetup
      deep_copy(@_stages)
    end

    publish variable: :language, type: "string"
    publish variable: :widgets_created, type: "boolean"
    publish variable: :opened_own_wizard, type: "boolean"
    publish variable: :relnotes, type: "string"
    publish function: :ChangeSlideIfNecessary, type: "void ()"
    publish function: :SetUserAbort, type: "void (boolean)"
    publish function: :GetUserAbort, type: "boolean ()"
    publish function: :StartTimer, type: "void ()"
    publish function: :ResetTimer, type: "void ()"
    publish function: :StopTimer, type: "void ()"
    publish function: :ShowingDetails, type: "boolean ()"
    publish function: :ShowingSlide, type: "boolean ()"
    publish function: :ShowingRelNotes, type: "boolean (symbol)"
    publish function: :SubProgressStart, type: "void (string)"
    publish function: :SubProgress, type: "void (integer, string)"
    publish function: :GlobalProgressStart, type: "void (string)"
    publish function: :CurrentStageDescription, type: "string ()"
    publish function: :MoveToStage, type: "void (string)"
    publish function: :StageProgress, type: "void (integer, string)"
    publish function: :SetGlobalProgressLabel, type: "void (string)"
    publish function: :AppendMessageToInstLog, type: "void (string)"
    publish function: :HaveSlideWidget, type: "boolean ()"
    publish function: :SetLanguage, type: "void (string)"
    publish function: :TableItem, type: "term (string, string, string, string, string)"
    publish function: :SwitchToReleaseNotesView, type: "void (symbol)"
    publish function: :RebuildDialog, type: "void ()"
    publish function: :Reset, type: "void ()"
    publish function: :HandleInput, type: "void (any)"
    publish function: :GenericHandleInput, type: "void ()"
    publish function: :OpenDialog, type: "void ()"
    publish function: :CloseDialog, type: "void ()"
    publish function: :ShowTable, type: "void ()"
    publish function: :HideTable, type: "void ()"
    publish function: :UpdateTable, type: "void (list <term>)"
    publish function: :Setup, type: "void (list <map <string, any>>)"
    publish function: :GetSetup, type: "map <string, map <string, any>> ()"
    publish function: :SetReleaseNotes, type: "void (map<string, string>, string)"
  end

  SlideShow = SlideShowClass.new
  SlideShow.main
end
