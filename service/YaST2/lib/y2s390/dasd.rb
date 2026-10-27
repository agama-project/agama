# Copyright (c) [2022] SUSE LLC
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

# Vendored from yast2-s390's src/lib/y2s390/dasd.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-s390` RPM
# is no longer a runtime dependency of Agama.

require "yast"
require "yast2/execute"

module Y2S390
  # This class represents a direct-access storage device (DASD)
  class Dasd
    # Command for configuring z Systems specific devices
    CONFIGURE_CMD = "/sbin/dasd_configure".freeze
    private_constant :CONFIGURE_CMD

    # Command for displaying configuration of z Systems DASD devices
    LIST_CMD = "/sbin/lsdasd".freeze
    private_constant :LIST_CMD

    # @return [Hash<String, Symbol>] a map of known statuses
    KNOWN_STATUS = {
      "offline"    => :offline,
      "active"     => :active,
      "active(ro)" => :read_only,
      "n/f"        => :no_format
    }.freeze
    private_constant :KNOWN_STATUS

    # @return [String] the DASD type (EKCD, FBA)
    attr_accessor :type

    # @return [String] the DASD device type, cpu model...
    attr_accessor :device_type

    # @return [String] the device id or channel
    attr_accessor :id

    # @return [String, nil] the associated device name
    attr_accessor :device_name

    # @return [Symbol] the device status (:offline, :active, :read_only, :no_format, :unknown)
    attr_reader :status

    # @return [Integer] number of cylinders
    attr_accessor :cylinders

    # @return [Boolean] whether the device should be formatted
    attr_accessor :format_wanted

    # @return [Boolean] whether the DIAG access method should be enabled
    attr_accessor :diag_wanted

    # @return [Boolean] whether the device is formatted
    attr_accessor :formatted

    # @return [Boolean] whether the DIAG access method is enabled
    attr_accessor :use_diag

    # Constructor
    #
    # @param id [String]
    # @param status [Symbol, nil]
    # @param device_name [String, nil]
    # @param type [String, nil]
    def initialize(id, status: nil, device_name: nil, type: nil)
      @id = id
      @device_name = device_name
      @type = type
      self.status = status
    end

    def hex_id
      @id.gsub(".", "").hex
    end

    # Sets the device status if known or :unknown if not
    #
    # @param value [String] device current status according to lsdasd output
    # @return [Symbol] device status (:active, :read_only, :offline, :no_format, or :unknown)
    def status=(value)
      @status = KNOWN_STATUS[value.to_s.downcase] || :unknown
    end

    # Whether the device is active according to its status
    #
    # @return [Boolean] true if it is in an active status; false otherwise
    def active?
      [:active, :read_only, :no_format].include?(status)
    end

    # Whether the device is active according to the IO {#hwinfo}
    #
    # @return [Boolean] true if it is active; false otherwise
    def io_active?
      hwinfo&.resource&.io&.first&.active
    end

    # Whether the device is offline based on its status
    #
    # @return [Boolean] whether the DASD device is offline or not
    def offline?
      status == :offline
    end

    # @return [Boolean] whether the DASD device is formatted or not
    def formatted?
      @formatted || false
    end

    # Whether the device can be formatted or not
    #
    # @return [Boolean] true when the devices is an active ECKD DASD; false otherwise
    def can_be_formatted?
      active? && type == "ECKD"
    end

    # Return the partitions information
    #
    # @return [String]
    def partition_info
      return "#{device_path}1" if type != "ECKD"

      out = Yast::Execute.stdout.on_target!("/sbin/fdasd", "-p", device_path)
      return out if out.empty?

      regexp = Regexp.new("^[ \t]*([^ \t]+)[ \t]+([0-9]+)[ \t]+([0-9]+)[ \t]+([0-9]+)" \
                          "[ \t]+([^ \t]+)[ \t]+([^ \t]+([ \t]+[^ \t]+))*[ \t]*$")

      lines = out.split("\n").grep(regexp)
      lines.map do |line|
        r = line.match(regexp)
        "#{r[1]} (#{r[6]})"
      end.join(", ")
    end

    # Returns the path to the device
    #
    # @return [String, nil]
    def device_path
      return unless device_name

      "/dev/#{device_name}"
    end

    # Returns the access type ('rw', 'ro') according to {#hwinfo}
    #
    # @return [Boolean, nil] true if it is active; false otherwise
    def access_type
      hwinfo&.resource&.io&.first&.mode
    end

    # Returns the access type ('rw', 'ro') according to {#hwinfo}
    #
    # @return [Integer, nil]
    def sysfs_id
      hwinfo&.sysfs_id
    end

    # Returns the system device name from the sysfs. i.e. 'dasd'
    #
    # @return [String, nil]
    def sys_device_name
      cmd = ["ls", "/sys/bus/ccw/devices/#{id}/block/"]
      disk = Yast::Execute.stdout.on_target!(cmd).strip
      disk.to_s.empty? ? nil : disk
    end

    # Returns the device data collected by hwinfo
    #
    # @return [Hash]
    def hwinfo
      Y2S390::HwinfoReader.instance.for_device(id)
    end
  end
end
