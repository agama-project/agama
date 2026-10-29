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

# Vendored from yast2-s390's src/lib/y2s390/dasds_reader.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-s390` RPM
# is no longer a runtime dependency of Agama.

require "y2s390/dasd"
require "yast2/execute"
require "y2s390/dasds_collection"
require "y2s390/hwinfo_reader"

Yast.import "Mode"

module Y2S390
  # Reads information about DASD devices in the system
  class DasdsReader
    attr_accessor :disks

    # Command for displaying configuration of z Systems DASD devices
    LIST_CMD = "/sbin/lsdasd".freeze
    private_constant :LIST_CMD

    # Initializes a collection of DASDs based on the information read using lsdasd output and also
    # the hardware information (hwinfo).
    #
    # @param offline [Boolean] whether it should obtain the offline devices too or not
    # @param force_probing [Boolean] in case of probing it will fetch the hwinfo;
    #   if not, it will use the information cached when exist
    # @return [Y2S390::DasdsCollection] a collection of DASD devices read from the system
    def list(offline: true, force_probing: false)
      HwinfoReader.instance.reset if force_probing

      a = dasd_entries(offline: offline).each_with_object([]) do |entry, arr|
        next unless entry.start_with?(/\d/)

        id, status, name, _, type, = entry.split
        attrs = Yast::Mode.config ? {} : { status: status, device_name: name, type: type }
        dasd = Y2S390::Dasd.new(id, **attrs).tap do |d|
          if Yast::Mode.config
            d.diag_wanted = d.use_diag = use_diag?(d)
            d.format_wanted = false
          else
            update_additional_info(d)
          end
        end

        arr << dasd
      end

      Y2S390::DasdsCollection.new(a)
    end

    # Refreshes data of given DASDs
    #
    # @param dasds [Y2S390::DasdsCollection] a collection of Y2S90::Dasd
    # @return [true]
    def refresh_data!(dasds)
      dasd_entries(offline: true).each do |entry|
        next unless entry.start_with?(/\d/)

        id, status, name, _, type, = entry.split
        dasd = dasds.by_id(id)
        next unless dasd

        dasd.status = status
        dasd.device_name = name
        dasd.type = type
        update_additional_info(dasd)
      end

      true
    end

    # Udpates information for given DASD
    #
    # @param dasd [Y2S390::Dasd] the DASD representation to be updated
    # @param extended [Boolean] whether additional information should be updated too
    def update_info(dasd, extended: false)
      data = dasd_entries(dasd: dasd).find { |e| e.start_with?(/\d/) }
      return false if data.to_s.empty?

      _, status, name, _, type, = data.split
      dasd.status = status
      dasd.device_name = name
      dasd.type = type
      update_additional_info(dasd) if extended
    end

  private

    # In production, call SCR.Read(.probe.disk).
    #
    # For testing, use S390_MOCKING=1 ENV variable or point YAST2_S390_LSDASD to a txt file
    # with the mock value with a lsdasd's command output format.
    #
    # Suggesstion:
    #   S390_MOCKING=1 rake run"[dasd]"
    #
    # @param offline [Boolean] whether it should obtain the offline devices too or not
    # @param dasd [Y2S390::Dasd]
    # @return [Array<Hash>] .probe.disk output
    def dasd_entries(offline: true, dasd: nil)
      filename = mock_filename
      if filename
        File.read(filename)
      else
        cmd = cmd_for(offline: offline, dasd: dasd)
        Yast::Execute.stdout.locally!(cmd)
      end.split("\n")
    end

    # Mock filenam if defined supported environment variables
    #
    # @return [String,nil]
    def mock_filename
      ENV["S390_MOCKING"] ? "test/data/lsdasd.txt" : ENV["YAST2_S390_LSDASD"]
    end

    # Build lsdasd command based on given params
    #
    # @params offline [Boolean] true for listing offline devices too; false othewise
    # @params dasd [Y2S390::Dasd, nil] a Y2S390::Dasd object for specifying the device
    #
    # @return [Array<String>] lsdasd command and options based on given params
    def cmd_for(offline: true, dasd: nil)
      cmd = [LIST_CMD]
      cmd << "-a" if offline
      cmd << dasd.id if dasd
      cmd
    end

    # Update given DASD representation with extended data
    #
    # @param dasd [Y2S390::Dasd]
    def update_additional_info(dasd)
      dasd.cylinders = nil if dasd.offline?
      dasd.use_diag = use_diag?(dasd)
      dasd.formatted = formatted?(dasd)
      dasd.device_type = device_type_for(dasd)
    end

    # Determines whether a given DASD is formatted or not
    #
    # @param dasd [DASD]
    # @return [Boolean]
    def formatted?(dasd)
      return false if dasd.offline?

      fmt_out = Yast::Execute.stdout.locally!(
        ["/sbin/dasdview", "--extended", "/dev/#{dasd.device_name}"], ["grep", "formatted"]
      )
      fmt_out.empty? ? false : !fmt_out.upcase.match?(/NOT[ \t]*FORMATTED/)
    end

    # Determines whether the given DASD has the DIAG access enabled or not
    #
    # @param dasd [DASD]
    # @return [Boolean]
    def use_diag?(dasd)
      diag_file = "/sys/#{dasd.sysfs_id}/device/use_diag"
      use_diag = Yast::SCR.Read(Yast.path(".target.string"), diag_file) if File.exist?(diag_file)
      use_diag.to_i == 1
    end

    # Get partitioninfo
    # @param [String] disk string Disk to read info from
    # @return GetPartitionInfo string The info
    def partition_info(dasd)
      return "#{dasd.device_path}1" if dasd.type != "ECKD"

      out = Yast::Execute.stdout.on_target!("/sbin/fdasd", "-p", dasd.device_path)
      return out if out.empty?

      regexp = Regexp.new("^[ \t]*([^ \t]+)[ \t]+([0-9]+)[ \t]+([0-9]+)[ \t]+([0-9]+)" \
                          "[ \t]+([^ \t]+)[ \t]+([^ \t]+([ \t]+[^ \t]+))*[ \t]*$")

      lines = out.split("\n").grep(regexp)
      lines.map do |line|
        r = line.match(regexp)
        "#{r[1]} (#{r[6]})"
      end.join(", ")
    end

    def device_type_for(dasd)
      hwinfo        = dasd&.hwinfo
      hwinfo_detail = hwinfo&.detail

      device_type   = (hwinfo&.device_id.to_i & 65535).to_s(16)
      sub_device_id = (hwinfo&.sub_device_id.to_i & 65535).to_s(16)
      cu_model      = hwinfo_detail&.cu_model.to_i.to_s(16).rjust(2, "0")
      dev_model     = hwinfo_detail&.dev_model.to_i.to_s(16).rjust(2, "0")

      "#{device_type}/#{cu_model} #{sub_device_id}/#{dev_model}".upcase
    end
  end
end
