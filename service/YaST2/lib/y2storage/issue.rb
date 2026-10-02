# Copyright (c) [2021] SUSE LLC
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

require "y2issues/issue"

module Y2Storage
  # Class to represent an issue
  class Issue < Y2Issues::Issue
    # Description of the issue
    #
    # @return [String, nil]
    attr_reader :description

    # Details of the issue
    #
    # Usually this contains technical details like the result of a command.
    #
    # @return [String, nil]
    attr_reader :details

    # Sid of the affected device, if any
    #
    # @return [Integer, nil]
    attr_reader :sid

    # Constructor
    #
    # @param message [String] message of the issue
    # @param description [String, nil] description of the issue
    # @param details [String, nil] details of the issue
    # @param device [Y2Storage::Device, nil] affected device
    def initialize(message, description: nil, details: nil, device: nil)
      super(message)

      @sid = device&.sid
      @description = description
      @details = details
    end
  end
end
