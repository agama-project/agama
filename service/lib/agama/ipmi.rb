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

    # See the body of #command for specification links
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

      # man ipmitool:
      #
      # The format of each line in the file is as follows:
      # <{EvM Revision} {Sensor Type} {Sensor Num} {Event Dir/Type}
      #  {Event Data 0} {Event Data 1} {Event Data 2}>[# COMMENT]
      # ...
      # EvM Revision - The "Event Message Revision" is 0x04 for messages that
      #                comply with the IPMI 2.0 Specification
      #                and 0x03 for messages that comply with the IPMI 1.0 Specification.
      # Sensor Type - Indicates the Event Type or Class.
      # Sensor Num - Represents the 'sensor' within the management controller
      #              that generated the Event Message.
      # Event  Dir/Type - This field is encoded with the event direction as the high bit (bit 7)
      #                   and the event type as the low 7 bits.  Event direction is
      #                   0 for an assertion event and 1 for a deassertion event.

      # https://www.intel.com/content/www/us/en/products/docs/servers/ipmi/ipmi-second-gen-interface-spec-v2-rev1-1.html
      #
      # 42.2 Sensor Type Codes and Data (page 512)
      # Sensor Type: 0x1f, Base OS Boot / Installation Status
      #
      # Event Type: 0x6f, Sensor-specific (page 503)
      file.write("0x4 0x1F 0x0 0x6f 0x#{code.to_s(16)} 0x0 0x0\n")
      file.close

      system("ipmitool event file #{file.path}")

      file.unlink
    end
  end
end
