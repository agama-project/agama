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
# File:  modules/Stage.ycp
# Module:  yast2
# Summary:  Installation mode
# Authors:  Klaus Kaempf <kkaempf@suse.de>
#    Jiri Srain <jsrain@suse.cz>
# Flags:  Stable
#
# $Id$
#
# Provide installation stage information.
require "yast"

module Yast
  class StageClass < Module
    def main
      textdomain "base"

      # Current stage
      @_stage = nil
    end

    # Get the current stage
    # @return [String] the current stage
    def stage
      if @_stage.nil?
        @_stage = "normal"

        arg_count = Builtins.size(WFM.Args)
        arg_no = 0
        while Ops.less_than(arg_no, arg_count)
          case WFM.Args(arg_no)
          when "initial"
            @_stage = "initial"
          when "continue"
            @_stage = "continue"
          when "firstboot"
            @_stage = "firstboot"
          when "reprobe"
            @_stage = "hardware_probed"
          end

          arg_no = Ops.add(arg_no, 1)
        end
      end
      @_stage
    end

    # Set the installation stage
    # @param [String] new_stage string currently processed stage
    def Set(new_stage)
      if !Builtins.contains(
        ["normal", "initial", "continue", "firstboot", "hardware_probed"],
        new_stage
      )
        Builtins.y2error("Unknown stage %1", new_stage)
      end

      Builtins.y2milestone("setting stage to %1", new_stage)
      @_stage = new_stage

      nil
    end

    # starting installation in inst-sys system
    # @return [Boolean] true if installation first stage is running
    def initial
      stage == "initial"
    end

    # continuing installation in target system
    # @return [Boolean] true if installation continues on the target system
    def cont
      stage == "continue"
    end

    # Firstboot stage
    # @return [Boolean] true if first-boot installation is running
    def firstboot
      stage == "firstboot"
    end

    # normal, running system
    # @return [Boolean] true if YaST was started normally
    def normal
      stage == "normal"
    end

    # This flag indicates that a config module has been called due to
    # a change in the system hardware that has been detected on boot
    # time.
    # @return [Boolean] true if YaST was invoked because new hardware was probed
    def reprobe
      stage == "hardware_probed"
    end

    publish function: :stage, type: "string ()"
    publish function: :Set, type: "void (string)"
    publish function: :initial, type: "boolean ()"
    publish function: :cont, type: "boolean ()"
    publish function: :firstboot, type: "boolean ()"
    publish function: :normal, type: "boolean ()"
    publish function: :reprobe, type: "boolean ()"
  end

  Stage = StageClass.new
  Stage.main
end
