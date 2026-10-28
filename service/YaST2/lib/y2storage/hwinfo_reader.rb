# Copyright (c) [2017-2021] SUSE LLC
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

require "y2storage/hwinfo_disk"
require "singleton"

module Y2Storage
  # Read hardware information for storage devices
  #
  # This class uses `hwinfo` to read hardware information from storage devices.
  # The information is read lazily for all devices at once and cached when the
  # #for_device method is called.
  #
  # The cache can be cleaned calling #reset.
  #
  # @example Get information for "/dev/sda"
  #   hwinfo = HWInfo.instance.for_device(name)
  #   hwinfo.driver      #=> ["ahci", "sd"]
  #   hwinfo.device_file #=> ["/dev/sda"]
  #   hwinfo.bus         #=> "IDE"
  #
  # @example Cleaning the cache
  #   HWInfo.instance.reset
  class HWInfoReader
    include Singleton

    # Return hardware info for the given device
    #
    # @param name [String] Device name (eg. "/dev/sda")
    # @return [HWInfoDisk] Hardware information
    def for_device(name)
      data[name] || HWInfoDisk.new
    end

    # Reset the cache
    #
    # The values will be loaded when #for_device is called again.
    def reset
      @data = nil
    end

    private

    # Return devices information from hwinfo
    #
    # The information is cached. It can be cleaned by calling #reset.
    #
    # @return [Hash<String,HWInfoDisk>] Hardware information indexed by device name
    #
    # @see #data_from_hwinfo
    # @see #reset
    def data
      @data ||= data_from_hwinfo
    end

    # @return [Regexp] Regular expression to extract the 'bus' from the first line
    BUS_REGEXP = /\A\d+: (\w+) /

    # @return [Regexp] Regular expression to split hwinfo output
    DEVICE_REGEXP = /^(\d.+\n)/

    # Extract devices information from hwinfo
    #
    # @return [Hash<String,HWInfoDisk>] Hardware information indexed by device name
    def data_from_hwinfo
      output = Yast::Execute.on_target!("/usr/sbin/hwinfo", "--disk", "--listmd", stdout: :capture)

      lines = output.split(DEVICE_REGEXP).reject(&:empty?)

      lines.each_slice(2).each_with_object({}) do |(header, body), data|
        details = data_from_body(body)
        next if details.device_file.nil?

        details.bus = header[BUS_REGEXP, 1]
        details.device_file.each { |n| data[n] = details }
      end
    end

    # Converts information from hwinfo to an HWInfoDisk
    #
    # By the way, it convers multi-valued properties to arrays.
    #
    # @return [HWInfoDisk] Sanitized hardware information
    def data_from_body(body)
      body.lines.map(&:strip).each_with_object(HWInfoDisk.new) do |line, data|
        key, value = line.split(":", 2)
        next if value.nil?

        key = key.downcase.tr(" ", "_").tr("()/", "")
        parsed_value = parse(key, value)
        data.public_send("#{key}=", parsed_value)
      end
    end

    # Parse a given value
    #
    # If a property needs special handling, a "parse_key_PROPERTY_NAME" can
    # be implemented and it will be used to parse the value (see #parse_key_device_file
    # as example).
    #
    # Otherwise, #parse_single or #parse_multi will be used.
    #
    # @param key   [String] Property name
    # @param value [String] Value to parse
    # @return [String,Array<String>] Parsed value(s)
    def parse(key, value)
      value = value.tr("\"()", "").strip

      handling_meth = "parse_key_#{key}"
      return send(handling_meth, value) if respond_to?(handling_meth, true)

      HWInfoDisk.multi_valued?(key) ? parse_multi(value) : parse_single(value)
    end

    # Parse the device_file key
    #
    # The device_file can contain up to two different values. See hwinfo sources
    # for further details:
    # https://github.com/openSUSE/hwinfo/blob/b3b2757b3633cde7f49c30757b9664defc773c86/src/hd/hdp.c#L468
    #
    # @param [String] value
    # @return [Array<String>] array containing all values
    def parse_key_device_file(value)
      value.split
    end

    # Sanitizes a single-value property
    #
    # @param value [String] Value to parse
    # @return [String] sanitized value
    def parse_single(value)
      value.strip
    end

    # Sanitizes a multi-value property
    #
    # @param value [String] Value to parse
    # @return [Array<String>] array containing all values
    def parse_multi(value)
      value.split(",").map(&:strip)
    end
  end
end
