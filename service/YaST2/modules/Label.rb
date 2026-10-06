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
# File:  modules/Label.ycp
# Package:  yast2
# Summary:  Often used messages and button labels
# Authors:  Gabriele Strattner <gs@suse.de>
#    Stefan Hundhammer <sh@suse.de>
#    Arvin Schnell <arvin@suse.de>
# Flags:  Stable
#
# $Id$
#
# See also <a href="../README.popups">README.popups</a>
require "yast"

module Yast
  class LabelClass < Module
    def main
      textdomain "base"
    end

    # Add Button
    def AddButton
      # Button label
      _("&Add")
    end

    # Cancel Button
    def CancelButton
      # Button label
      _("&Cancel")
    end

    # Continue Button
    def ContinueButton
      # Button label
      _("C&ontinue")
    end

    # Yes Button
    def YesButton
      # Button label
      _("&Yes")
    end

    # No Button
    def NoButton
      # Button label
      _("&No")
    end

    # Finish Button
    def FinishButton
      # Button label
      _("&Finish")
    end

    # Edit Button
    def EditButton
      # Button label
      _("Ed&it")
    end

    # OK Button
    def OKButton
      # Button label
      _("&OK")
    end

    # Abort Button
    def AbortButton
      # Button label
      _("Abo&rt")
    end

    # Abort Installation Button
    def AbortInstallationButton
      # Button label
      _("Abo&rt Installation")
    end

    # Ignore Button
    def IgnoreButton
      # Button label
      _("&Ignore")
    end

    # Next Button
    def NextButton
      # Button label
      _("&Next")
    end

    # New Button
    def NewButton
      # Button label
      _("Ne&w")
    end

    # Delete Button
    def DeleteButton
      # Button label
      _("Dele&te")
    end

    # Back Button
    def BackButton
      # Button label
      _("&Back")
    end

    # Accept Button
    def AcceptButton
      # Button label
      _("&Accept")
    end

    # Do Not Accept Button
    def DoNotAcceptButton
      # Button label
      _("&Do Not Accept")
    end

    # Quit Button
    def QuitButton
      # Button label
      _("&Quit")
    end

    # Retry Button
    def RetryButton
      # Button label
      _("Retr&y")
    end

    # Replace Button
    def ReplaceButton
      # Button label
      _("&Replace")
    end

    # Up Button
    def UpButton
      # Button label
      _("&Up")
    end

    # Down Button
    def DownButton
      # Button label
      _("Do&wn")
    end

    # Select Button
    def SelectButton
      # Button label
      _("Sele&ct")
    end

    # Remove Button
    def RemoveButton
      # Button label
      _("Remo&ve")
    end

    # Modify Button
    def ModifyButton
      # Button label
      _("&Modify")
    end

    # Refresh Button
    def RefreshButton
      # Button label
      _("&Refresh")
    end

    # Help Button
    def HelpButton
      # Button label
      _("&Help")
    end

    # Install Button
    def InstallButton
      # Button label
      _("&Install")
    end

    # Don't Install Button
    def DontInstallButton
      # Button label
      _("&Do Not Install")
    end

    # Download Button
    def DownloadButton
      # Button label
      _("&Download")
    end

    # Save Button
    def SaveButton
      # Button label
      _("&Save")
    end

    # Stop Button
    def StopButton
      # Button label
      _("&Stop")
    end

    # Close Button
    def CloseButton
      # Button label
      _("C&lose")
    end

    # Browse Button
    def BrowseButton
      # Button label
      _("Bro&wse...")
    end

    # Create Button
    def CreateButton
      # Button label
      _("Crea&te")
    end

    # Skip Button
    def SkipButton
      # Button label
      _("&Skip")
    end

    # Warning Message
    def WarningMsg
      # this string is usually used as headline of a popup
      _("Warning")
    end

    # Error Message
    def ErrorMsg
      # this string is usually used as headline of a popup
      _("Error")
    end

    # Please wait Message
    def PleaseWaitMsg
      # this string is usually used as headline of a popup
      _("Please wait...")
    end

    # Default function key map
    def DefaultFunctionKeyMap
      fkeys = {}

      # A map only accepts constants as keys, so we have to add() each
      # item. It will always be a term since it has to go through the
      # translator.

      fkeys = Builtins.add(fkeys, HelpButton(), 1)
      fkeys = Builtins.add(fkeys, AddButton(), 3)
      fkeys = Builtins.add(fkeys, EditButton(), 4)
      fkeys = Builtins.add(fkeys, DeleteButton(), 5)
      fkeys = Builtins.add(fkeys, BackButton(), 8)

      # Negative Answers: [F9]
      fkeys = Builtins.add(fkeys, CancelButton(), 9)
      fkeys = Builtins.add(fkeys, NoButton(), 9)
      fkeys = Builtins.add(fkeys, DoNotAcceptButton(), 9)
      fkeys = Builtins.add(fkeys, DontInstallButton(), 9)
      fkeys = Builtins.add(fkeys, QuitButton(), 9)

      # Positive Answers: [F10]
      fkeys = Builtins.add(fkeys, OKButton(), 10)
      fkeys = Builtins.add(fkeys, AcceptButton(), 10)
      fkeys = Builtins.add(fkeys, YesButton(), 10)
      fkeys = Builtins.add(fkeys, CloseButton(), 10)
      fkeys = Builtins.add(fkeys, ContinueButton(), 10)
      fkeys = Builtins.add(fkeys, FinishButton(), 10)
      fkeys = Builtins.add(fkeys, InstallButton(), 10)
      fkeys = Builtins.add(fkeys, NextButton(), 10)
      fkeys = Builtins.add(fkeys, SaveButton(), 10)

      deep_copy(fkeys)
    end

    # LABEL -- MESSAGES FOR ANOTHER WIDGETS

    # TextEntry

    # File Name TextEntry
    def FileName
      # TextEntry Label
      _("&Filename")
    end

    # Password TextEntry
    def Password
      # TextEntry Label
      _("&Password")
    end

    # Confirm Password TextEntry
    def ConfirmPassword
      # TextEntry Label
      _("C&onfirm Password")
    end

    # Port TextEntry
    def Port
      # TextEntry Label
      _("&Port")
    end

    # Host Name TextEntry
    def HostName
      # TextEntry Label
      _("&Hostname")
    end

    # Options TextEntry
    def Options
      # TextEntry Label
      _("&Options")
    end

    publish function: :AddButton, type: "string ()"
    publish function: :CancelButton, type: "string ()"
    publish function: :ContinueButton, type: "string ()"
    publish function: :YesButton, type: "string ()"
    publish function: :NoButton, type: "string ()"
    publish function: :FinishButton, type: "string ()"
    publish function: :EditButton, type: "string ()"
    publish function: :OKButton, type: "string ()"
    publish function: :AbortButton, type: "string ()"
    publish function: :AbortInstallationButton, type: "string ()"
    publish function: :IgnoreButton, type: "string ()"
    publish function: :NextButton, type: "string ()"
    publish function: :NewButton, type: "string ()"
    publish function: :DeleteButton, type: "string ()"
    publish function: :BackButton, type: "string ()"
    publish function: :AcceptButton, type: "string ()"
    publish function: :DoNotAcceptButton, type: "string ()"
    publish function: :QuitButton, type: "string ()"
    publish function: :RetryButton, type: "string ()"
    publish function: :ReplaceButton, type: "string ()"
    publish function: :UpButton, type: "string ()"
    publish function: :DownButton, type: "string ()"
    publish function: :SelectButton, type: "string ()"
    publish function: :RemoveButton, type: "string ()"
    publish function: :RefreshButton, type: "string ()"
    publish function: :HelpButton, type: "string ()"
    publish function: :InstallButton, type: "string ()"
    publish function: :DontInstallButton, type: "string ()"
    publish function: :DownloadButton, type: "string ()"
    publish function: :SaveButton, type: "string ()"
    publish function: :StopButton, type: "string ()"
    publish function: :CloseButton, type: "string ()"
    publish function: :BrowseButton, type: "string ()"
    publish function: :CreateButton, type: "string ()"
    publish function: :SkipButton, type: "string ()"
    publish function: :WarningMsg, type: "string ()"
    publish function: :ErrorMsg, type: "string ()"
    publish function: :PleaseWaitMsg, type: "string ()"
    publish function: :DefaultFunctionKeyMap, type: "map <string, integer> ()"
    publish function: :FileName, type: "string ()"
    publish function: :Password, type: "string ()"
    publish function: :ConfirmPassword, type: "string ()"
    publish function: :Port, type: "string ()"
    publish function: :HostName, type: "string ()"
    publish function: :Options, type: "string ()"
  end

  Label = LabelClass.new
  Label.main
end
