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

# Vendored from yast2-s390's src/lib/y2s390/hwinfo_reader.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-s390` RPM
# is no longer a runtime dependency of Agama.

require "yaml"

module Y2S390
  class HwinfoReader
    include Singleton

    def for_device(id, force_probing: false)
      reset if force_probing

      data[id]
    end

    def reset
      @data = nil
    end

    def data
      @data ||= data_from_hwinfo
    end

  private

    def disks
      if mock_filename
        load_data(mock_filename)
      else
        Yast::SCR.Read(Yast.path(".probe.disk")) || []
      end
    end

    def mock_filename
      ENV["S390_MOCKING"] ? "test/data/probe_disk_dasd.yml" : ENV["YAST2_S390_PROBE_DISK"]
    end

    def data_from_hwinfo
      disks.each_with_object({}) do |disk, hash|
        hw_data = struct_for(disk)
        hash[hw_data.sysfs_bus_id] = hw_data
      end
    end

    def struct_for(hash_value)
      hash_value.each_with_object(OpenStruct.new) do |(k, v), data|
        value = if k == "io" && v.is_a?(Array)
          v.first.is_a?(Hash) ? v.map { |e| struct_for(e) } : v
        else
          v.is_a?(Hash) ? struct_for(v) : v
        end

        data.public_send("#{k}=", value)
      end
    end

    def load_data(name)
      YAML.safe_load(File.read(name))
    end
  end
end
