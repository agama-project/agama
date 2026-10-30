# Copyright (c) [2023] SUSE LLC
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

# Vendored from yast2-s390's src/lib/y2s390/zfcp.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-s390` RPM
# is no longer a runtime dependency of Agama.

require "yast"
require "yaml"

module Y2S390
  # Manager for zFCP devices
  #
  # About allow_lun_scan option:
  #   * It is enabled by default since SLE 12.
  #   * It can be disabled by means of a kernel parameter (zfcp.allow_lun_scan=0).
  #   * Configuring it once the system boots is discouraged, see
  #     https://bugzilla.suse.com/show_bug.cgi?id=1210597#c20
  class ZFCP
    include Yast
    include Yast::Logger

    ALLOW_LUN_SCAN_FILE = "/sys/module/zfcp/parameters/allow_lun_scan".freeze
    private_constant :ALLOW_LUN_SCAN_FILE

    # Detected controllers
    #
    # @return [Array<Hash>] keys for each hash:
    #   "sysfs_bus_id", "resource"
    attr_reader :controllers

    # Detected LUN disks
    #
    # @return [Array<Hash>] keys for each hash:
    #   "dev_name", "detail", "vendor", "device" and "io".
    attr_reader :disks

    def initialize
      @controllers = []
      @disks = []
    end

    # Whether the allow_lun_scan option is active
    #
    # Having allow_lun_scan active has some implications:
    #   * All LUNs are automatically activated when the controller is activated.
    #   * LUNs cannot be deactivated.
    #
    # @return [Boolean]
    def allow_lun_scan?
      return false unless File.exist?(ALLOW_LUN_SCAN_FILE)

      allow = Yast::SCR.Read(path(".target.string"), ALLOW_LUN_SCAN_FILE).chomp
      allow == "Y"
    end

    # Probes the zFCP controllers
    def probe_controllers
      make_all_devices_visible

      storage_devices = Yast::SCR.Read(path(".probe.storage"))
      controllers = storage_devices.select { |i| i["device"] == "zFCP controller" }

      @controllers = controllers.map { |c| c.slice("sysfs_bus_id", "resource") }
    end

    # Probes the zFCP disks
    def probe_disks
      storage_disks = read_mock_disks || Yast::SCR.Read(path(".probe.disk"))
      zfcp_disks = storage_disks.select { |d| d["driver"] == "zfcp" }

      tapes = Yast::SCR.Read(path(".probe.tape"))
      scsi_tapes = tapes.select { |t| t["bus"] == "SCSI" }

      disks = zfcp_disks + scsi_tapes

      @disks = disks.map { |d| d.slice("dev_name", "detail", "vendor", "device", "io") }
    end

    # Runs the command for activating a controller
    #
    # @note All LUNs are automatically activated if "allow_lun_scan" is active, see
    #   https://www.ibm.com/docs/en/linux-on-systems?topic=wsd-configuring-devices.
    #
    # @param channel [String] E.g., "0.0.fa00"
    # @return [Hash] See {#run}. The exit code corresponds to the chzdev one.
    def activate_controller(channel)
      command = format("/sbin/zfcp_host_configure '%s' %d", channel, 1)
      run(command)
    end

    # Whether the controller is activated
    #
    # @param channel [String] E.g., "0.0.fa00"
    # @return [Boolean]
    def activated_controller?(channel)
      controller = controllers.find { |c| c["sysfs_bus_id"] == channel }
      return false unless controller

      io = controller.dig("resource", "io") || []
      io.any? { |i| i["active"] }
    end

    # Whether the controller is performing auto LUN scan
    #
    # For that, allow_lun_scan must be active and the controller must be running in NPIV mode.
    #
    # @param channel [String] E.g., "0.0.fa00"
    # @return [Boolean]
    def lun_scan_controller?(channel)
      files = Dir["/sys/bus/ccw/drivers/zfcp/#{channel}/host*/fc_host/host*/port_type"]
      return false unless allow_lun_scan? && files.any?

      port_types = files.map { |f| Yast::SCR.Read(path(".target.string"), f).chomp }
      port_types.any? { |t| t == "NPIV VPORT" }
    end

    # Runs the command for activating a zFCP disk
    #
    # @param channel [String] E.g., "0.0.fa00"
    # @param wwpn [String] E.g., "0x500507630708d3b3"
    # @param lun [String] E.g., "0x0013000000000000"
    #
    # @return [Hash] See {#run}. The exit code corresponds to the chzdev one.
    def activate_disk(channel, wwpn, lun)
      command = format("/sbin/zfcp_disk_configure '%s' '%s' '%s' %d", channel, wwpn, lun, 1)
      run(command)
    end

    # Runs the command for deactivating a zFCP disk
    #
    # @note Deactivate fails if "allow_lun_scan" is active, see
    #   https://www.ibm.com/docs/en/linux-on-systems?topic=wsd-configuring-devices.
    #
    # @param channel [String] E.g., "0.0.fa00"
    # @param wwpn [String] E.g., "0x500507630708d3b3"
    # @param lun [String] E.g., "0x0013000000000000"
    #
    # @return [Hash] See {#run}. The exit code corresponds to the chzdev one.
    def deactivate_disk(channel, wwpn, lun)
      command = format("/sbin/zfcp_disk_configure '%s' '%s' '%s' %d", channel, wwpn, lun, 0)
      run(command)
    end

    # Runs the command for finding WWPNs
    #
    # @param channel [String] E.g., "0.0.fa00"
    # @return [Hash] See {#run}
    def find_wwpns(channel)
      command = format("zfcp_san_disc -b '%s' -W", channel)
      run(command)
    end

    # Runs the command for finding LUNs
    #
    # @param channel [String] E.g., "0.0.fa00"
    # @param wwpn [String] E.g., "0x500507630708d3b3"
    #
    # @return [Hash] See {#run}
    def find_luns(channel, wwpn)
      command = format("zfcp_san_disc -b '%s' -p '%s' -L", channel, wwpn)
      run(command)
    end

  private

    # Sets all detected controllers as visible
    def make_all_devices_visible
      # Checking if it is a z/VM and evaluating all FCP controllers in order to activate
      output = run("/sbin/vmcp q v fcp")
      return if output["exit"] != 0

      fcp_lines = output["stdout"].map(&:split).select { |l| l.first == "FCP" }
      devices = fcp_lines.map { |l| l[1].downcase }

      # Remove all needed devices from CIO device driver blacklist in order to see it
      devices.each do |device|
        log.info "Removing #{device} from the CIO device driver blacklist"
        run("/sbin/cio_ignore -r #{device}")
      end
    end

    # Runs the given command
    #
    # @param command [String]
    # @return [Hash] Output of the command which has these keys: "exit", "stdout", "stderr".
    def run(command)
      Yast::SCR.Execute(path(".target.bash_output"), command).tap do |output|
        log.info("command #{command} output #{output}")

        output["exit"] = output["exit"].to_i
        output["stdout"] = output["stdout"].split("\n").reject(&:empty?)
      end
    end

    # Reads the mock disks from the YAML file pointed by YAST2_S390_PROBE_DISK
    #
    # Suggestion: YAST2_S390_PROBE_DISK=test/data/probe_disk.yml rake run[zfcp]
    #
    # @return [Array<Hash>, nil] List of mocked LUN disks or nil if no file found
    def read_mock_disks
      mock_filename = ENV["YAST2_S390_PROBE_DISK"]
      return nil unless mock_filename

      YAML.safe_load(File.read(mock_filename))
    end
  end
end
