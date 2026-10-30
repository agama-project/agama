# Copyright (c) [2018-2023] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "y2storage/proposal/space_maker_actions"

module Y2Storage
  module Proposal
    module SpaceMakerProspects
      # Abstract class to represent a possible action to be performed by
      # SpaceMaker on the system.
      #
      # This class (and its descendants) are used by the YaST GuidedProposal as a mechanism to
      # generate the real list of actions (SpaceMakerActions) that will executed. Not all prospects
      # will end up being translated into an action and consumed by SpaceMaker.
      class Base
        include Yast::Logger

        # Identifier of the target device
        # @return [Integer]
        attr_reader :sid

        # Kernel name of the target device
        # @return [String]
        attr_reader :device_name

        # @see available?
        attr_writer :available

        # @param device [BlkDevice]
        def initialize(device)
          @sid = device.sid
          @device_name = device.name
          @available = true
        end

        # Corresponding action that would be consumed by SpaceMaker
        #
        # @return [SpaceMakerActions::Base]
        def action
          @action ||= action_class.new(sid)
        end

        # Whether the prospect action is still possible
        #
        # @return [Boolean] false if the action has already being performed or
        #   if it has become impossible as side effect of another performed action
        def available?
          @available
        end

        # @return [String]
        def to_s
          "<#{sid} (#{device_name})>"
        end
      end
    end
  end
end
