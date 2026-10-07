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
# File:  modules/Mode.ycp
# Module:  yast2
# Summary:  Installation mode
# Authors:  Klaus Kaempf <kkaempf@suse.de>
# Flags:  Stable
#
# $Id$
#
# Provide installation mode information.
# Mostly values from /etc/install.inf
# See linuxrc documentation for detailed docs about this.
require "yast"

module Yast
  # There are three modes combined here:
  #
  # 1. Installation
  # 2. UI
  # 3. Test
  #
  # See the boolean methods linked in the below tables for the *meaning*
  # of the modes.
  #
  # A related concept is the installation {StageClass Stage}.
  #
  # # *Installation* mode
  #
  # It is the most complex one. Its values are used in the installation
  # {https://github.com/yast/?query=skelcd-control control files}.
  #
  # It has these mutually exclusive values and corresponding boolean queries:
  # <table>
  # <tr><th> {#mode} value </th>    <th colspan=3> boolean shortcut   </th></tr>
  # <tr><td> normal </td>           <td colspan=3> {#normal}          </td></tr>
  # <tr><td> installation </td>     <td rowspan=3> {#installation}    </td></tr>
  # <tr><td> live_installation </td><td colspan=2>         {#live_installation} </td></tr>
  # <tr><td> autoinstallation </td> <td colspan=1>         {#autoinst} (short!) </td><td rowspan=2>#auto</td></tr>
  # <tr><td> autoupgrade </td>      <td colspan=2> {#autoupgrade}     </td></tr>
  # <tr><td> autoinst_config </td>  <td colspan=3> {#config}          </td></tr>
  # <tr><td> update </td>           <td rowspan=2> {#update}          </td></tr>
  # <tr><td> repair (obsolete) </td><td colspan=3> {#repair}          </td></tr>
  # </table>
  #
  # # *UI* mode
  #
  # It has these mutually exclusive values and corresponding boolean queries:
  # <table>
  # <tr><th> {#ui} value</th>   <th> boolean shortcut </th></tr>
  # <tr><td> dialog       </td> <td> (none)           </td></tr>
  # <tr><td> commandline  </td> <td> {#commandline}   </td></tr>
  # <tr><td> none(*)      </td> <td> (none)           </td></tr>
  # </table>
  #
  # Apparently "none" is never used.
  #
  # # *Test* mode
  #
  # It has these mutually exclusive values and corresponding boolean queries:
  # <table>
  # <tr><th> {#testMode} value</th>  <th colspan=2> boolean shortcut </th> </tr>
  # <tr><td> test </td>              <td rowspan=3> {#test} </td></tr>
  # <tr><td> testsuite  </td>        <td> {#testsuite}      </td></tr>
  # <tr><td> screenshot (obsolete)</td><td> {#screen_shot}  </td></tr>
  # </table>
  class ModeClass < Module
    def main
      textdomain "base"

      # Current mode
      @_mode = nil

      # Current testing mode
      @_test = nil

      # We do one automatic check whether _test should be set to testsuite.
      @test_autochecked = false

      # Current UI mode
      @_ui = "dialog"
    end

    # Initialize everything from command-line of y2base.
    #
    # @note {#ui} aka {#commandline} is not initialized. Probably a bug.
    def Initialize
      @_mode = "normal"
      @_test = "none"
      arg_count = Builtins.size(WFM.Args)
      arg_no = 0
      while Ops.less_than(arg_no, arg_count)
        # parsing for main mode
        case WFM.Args(arg_no)
        when "initial", "continue", "firstboot"
          @_mode = "installation"
        # parsing for test mode
        when "test", "demo"
          @_test = "test"
          Builtins.y2warning("***** Test mode enabled *****")
        when "screenshots"
          @_test = "screenshot"
          Builtins.y2warning("***** Screen shot mode enabled *****")
        end

        arg_no = Ops.add(arg_no, 1)
      end

      # only use the /etc/install.inf agent when file is present
      # and installation is being processed
      # FIXME: remove the part below and let it be set in clients
      if @_mode == "installation" &&
          SCR.Read(path(".target.size"), "/etc/install.inf") != -1

        autoinst = !SCR.Read(path(".etc.install_inf.AutoYaST")).nil?
        @_mode = "autoinstallation" if autoinst

        repair = !SCR.Read(path(".etc.install_inf.Repair")).nil?
        @_mode = "repair" if repair

        update = !SCR.Read(path(".etc.install_inf.Upgrade")).nil?
        @_mode = "update" if update

        autoupgrade = !SCR.Read(path(".etc.install_inf.AutoUpgrade")).nil?
        @_mode = "autoupgrade" if autoupgrade
      end

      nil
    end

    # main mode definitions

    # Returns the current mode name. It's one of
    # "installation", "normal", "update", "repair", "autoinstallation", "autoinst_config"
    def mode
      Initialize() if @_mode.nil?

      @_mode
    end

    # Setter for {#mode}.
    def SetMode(new_mode)
      Initialize() if @_mode.nil?

      if !Builtins.contains(
        [
          "installation",
          "update",
          "normal",
          "repair",
          "autoinstallation",
          "autoinst_config",
          "live_installation",
          "autoupgrade"
        ],
        new_mode
      )
        Builtins.y2error("Unknown mode %1", new_mode)
      end

      Builtins.y2milestone("setting mode to %1", new_mode)
      @_mode = new_mode

      nil
    end

    # test mode definitions

    def testMode
      Initialize() if @_test.nil?
      if !@test_autochecked
        # bnc#243624#c13: Y2ALLGLOBAL is set by yast2-testsuite/skel/runtest.sh
        if !Builtins.getenv("Y2MODETEST").nil? ||
            !Builtins.getenv("Y2ALLGLOBAL").nil?
          @_test = "testsuite"
        end
        @test_autochecked = true
      end

      @_test
    end

    # Setter for {#testMode}
    def SetTest(new_test_mode)
      Initialize() if @_test.nil?

      if !Builtins.contains(
        ["none", "test", "demo", "screenshot", "testsuite"],
        new_test_mode
      )
        Builtins.y2error("Unknown test mode %1", new_test_mode)
      end
      @_test = new_test_mode

      nil
    end

    # UI mode definitions

    # Returns the current UI mode.
    # It's one of "commandline", "dialog", "none"
    def ui
      @_ui
    end

    # Setter for {#ui}.
    def SetUI(new_ui)
      Builtins.y2error("Unknown UI mode %1", new_ui) if !Builtins.contains(["commandline", "dialog", "none"], new_ui)
      @_ui = new_ui

      nil
    end

    # main mode wrappers

    # We're doing a fresh installation, not an {#update}.
    # Also true for the firstboot stage.
    def installation
      mode == "installation" || mode == "autoinstallation" ||
        mode == "live_installation"
    end

    # We're doing a fresh installation from live CD/DVD.
    # {#installation} is also true.
    def live_installation
      mode == "live_installation"
    end

    # We're doing a distribution upgrade (wrongly called an "update").
    def update
      mode == "update" || mode == "autoupgrade"
    end

    # Depeche Mode. If you are a Heavy Metal fan, too bad!
    def Depeche
      true
    end

    # The default installation mode. That is, no installation is taking place.
    # We are configuring a system whose installation has concluded.
    def normal
      mode == "normal"
    end

    # Repair mode. Probably obsolete since the feature was dropped.
    def repair
      mode == "repair"
    end

    # Doing auto-installation with AutoYaST.
    # This is different from the {#config} part of AY.
    # {#installation} is also true.
    def autoinst
      mode == "autoinstallation"
    end

    # Doing auto-upgrade. {#update} is also true.
    # {#autoinst} is false even though AY is running,
    # which is consistent with {#installation} being exclusive with {#update}.
    def autoupgrade
      mode == "autoupgrade"
    end

    # Doing auto-installation or auto-upgrade with AutoYaST.
    def auto
      autoinst || autoupgrade
    end

    # Configuration for {#autoinst}, usually in the running system.
    #
    # @note also true during the installation
    #  when cloning the just installed system.
    def config
      mode == "autoinst_config"
    end

    # test mode wrappers

    # Synonym of {#testsuite}.
    # (Formerly (2006) this was a different thing, an obsolete "dry-run"
    # AKA "demo" mode. But the current usage means "{#testsuite}")
    def test
      testMode == "test" || testMode == "screenshot" || testMode == "testsuite"
    end

    # Formerly used to help take screenshots for the manuals.
    # Obsolete since 2006.
    def screen_shot
      testMode == "screenshot"
    end

    # Returns whether running in testsuite.
    # Set by legacy test framework yast2-testsuite, used to work around
    # non existent stubbing. Avoid!
    def testsuite
      testMode == "testsuite"
    end

    # UI mode wrappers

    # We're running in command line interface, not in GUI or ncurses TUI.
    #
    # @note this is set in the {CommandLineClass CommandLine} library,
    #  not in the core, and defaults to false.
    # @return true if command-line is running
    def commandline
      ui == "commandline"
    end

    publish function: :Initialize, type: "void ()"
    publish function: :mode, type: "string ()"
    publish function: :SetMode, type: "void (string)"
    publish function: :commandline, type: "boolean ()"
    publish function: :testMode, type: "string ()"
    publish function: :SetTest, type: "void (string)"
    publish function: :ui, type: "string ()"
    publish function: :SetUI, type: "void (string)"
    publish function: :installation, type: "boolean ()"
    publish function: :live_installation, type: "boolean ()"
    publish function: :update, type: "boolean ()"
    publish function: :Depeche, type: "boolean ()"
    publish function: :normal, type: "boolean ()"
    publish function: :repair, type: "boolean ()"
    publish function: :autoinst, type: "boolean ()"
    publish function: :autoupgrade, type: "boolean ()"
    publish function: :config, type: "boolean ()"
    publish function: :test, type: "boolean ()"
    publish function: :screen_shot, type: "boolean ()"
    publish function: :testsuite, type: "boolean ()"
  end

  Mode = ModeClass.new
  Mode.main
end
