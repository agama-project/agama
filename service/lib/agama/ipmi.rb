# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "yast"
require "agama/config"
require "tempfile"

module Agama
  # Class for very basic IPMI support
  #
  # Use for reporting current installer state to IPMI.
  #
  # Implemented:
  # * STARTED
  # * FAILED
  # * FINISHED
  # * ABORTED
  class Ipmi
    # @return [Logger]
    attr_reader :logger

    def initialize(logger)
      @logger = logger

      logger.info("IPMI available: #{available?}")
    end

    def started
      command(IPMI_STARTED)
    end

    def finished
      command(IPMI_FINISHED)
    end

    def aborted
      command(IPMI_ABORTED)
    end

    def failed
      command(IPMI_FAILED)
    end

  private

    IPMI_STARTED = 0x7
    IPMI_FINISHED = 0x8
    IPMI_ABORTED = 0x9
    IPMI_FAILED = 0xA

    def available?
      # Check whether we have a ipmi device and tool to use it.
      # ipmi0 is used as a default in ipmitool
      File.exist?("/dev/ipmi0") && File.exist?("/usr/bin/ipmitool")
    end

    # Sends an event to IPMI when /dev/ipmi0 device is available
    #
    # Events are 7B long but differs only in the command code.
    #
    # @param code [Byte] one byte in hex
    def command(code)
      return if !available?

      # ipmitool wants to read events from a file, not possible to
      # pass it directly as an argument
      file = Tempfile.new("agama-ipmi")

      file.write("0x4 0x1F 0x0 0x6f %#{code} 0x0 0x0\n")
      file.close

      system("ipmitool event file #{file.path}")

      file.unlink
    end
  end
end
