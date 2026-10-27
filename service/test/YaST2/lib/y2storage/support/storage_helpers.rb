# frozen_string_literal: true

# Copyright (c) [2016-2019] SUSE LLC
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

# DEVIATION FROM UPSTREAM: dropped the "require y2partitioner/device_graphs" and the
# Y2Partitioner::DeviceGraphs.create_instance call inside #devicegraph_stub. The
# y2partitioner tree is never vendored (confirmed unused by Agama), and none of the
# ported specs that call #devicegraph_stub rely on that partitioner-specific cache.

require "rspec"
require "yast"
require "storage"
require "y2storage"

Yast.import "ProductFeatures"

module Yast
  module RSpec
    # RSpec extension to add YaST Storage specific helpers
    #
    # rubocop:disable Metrics/ModuleLength
    module StorageHelpers
      def input_file_for(name, suffix: "yml")
        if suffix
          File.join(DATA_PATH, "devicegraphs", "#{name}.#{suffix}")
        else
          File.join(DATA_PATH, "devicegraphs", name)
        end
      end

      def output_file_for(name)
        File.join(DATA_PATH, "devicegraphs", "output", "#{name}.yml")
      end

      def fake_scenario(scenario)
        Y2Storage::StorageManager.create_test_instance

        if scenario.end_with?(".xml")
          Y2Storage::StorageManager.instance.probe_from_xml(input_file_for(scenario, suffix: nil))
        else
          Y2Storage::StorageManager.instance.probe_from_yaml(input_file_for(scenario))
        end
      end

      # Used when testing the partitioner
      def devicegraph_stub(name)
        # Backwards compatibility, #fake_scenario assumes Yaml by default, but
        # #devicegraph_stub always expects the full file name
        name = name.chomp(".yml")
        fake_scenario(name)

        Y2Storage::StorageManager.instance
      end

      def fake_devicegraph
        Y2Storage::StorageManager.instance.probed
      end

      def devicegraph_from(file_name)
        storage = Y2Storage::StorageManager.instance.storage
        st_graph = Storage::Devicegraph.new(storage)
        graph = Y2Storage::Devicegraph.new(st_graph)

        if file_name.end_with?(".xml")
          input = input_file_for(file_name, suffix: nil)
          st_graph.load(input)
        else
          input = input_file_for(file_name)
          Y2Storage::FakeDeviceFactory.load_yaml_file(graph, input)
        end

        graph
      end

      # Allows to create an empty disk
      #
      # @param name [String]
      # @param size [Y2Storage::DiskSize]
      # @param devicegraph [Y2Storage::Devicegraph] target devicegraph
      def create_empty_disk(name, size, devicegraph = nil)
        devicegraph ||= Y2Storage::StorageManager.instance.probed

        disk = Y2Storage::Disk.create(devicegraph, name)
        disk.size = size
      end

      def partition_double(name = "", disk_size = Y2Storage::DiskSize.MiB(10))
        instance_double("Y2Storage::Partition", name: name, size: disk_size, sid: 42)
      end

      def swap_double(name = "", disk_size = Y2Storage::DiskSize.MiB(10))
        instance_double("Y2Storage::Partition", name: name, size: disk_size, swap?: swap, sid: 42)
      end

      def planned_partition(attrs = {})
        part = Y2Storage::Planned::Partition.new(nil)
        add_planned_attributes(part, attrs)
      end

      # Backwards compatibility
      alias_method :planned_vol, :planned_partition

      def planned_vg(attrs = {})
        vg = Y2Storage::Planned::LvmVg.new
        add_planned_attributes(vg, attrs)
      end

      def planned_lv(attrs = {})
        lv = Y2Storage::Planned::LvmLv.new(nil)
        add_planned_attributes(lv, attrs)
      end

      def planned_md(attrs = {})
        md = Y2Storage::Planned::Md.new
        add_planned_attributes(md, attrs)
      end

      def planned_stray_blk_device(attrs = {})
        device = Y2Storage::Planned::StrayBlkDevice.new
        add_planned_attributes(device, attrs)
      end

      def planned_disk(attrs = {})
        disk = Y2Storage::Planned::Disk.new
        add_planned_attributes(disk, attrs)
      end

      def planned_bcache(attrs = {})
        bcache = Y2Storage::Planned::Bcache.new
        add_planned_attributes(bcache, attrs)
      end

      def planned_nfs(attrs = {})
        nfs = Y2Storage::Planned::Nfs.new
        add_planned_attributes(nfs, attrs)
      end

      def planned_btrfs(name, attrs = {})
        btrfs = Y2Storage::Planned::Btrfs.new(name)
        add_planned_attributes(btrfs, attrs)
      end

      def planned_tmpfs(mount, attrs = {})
        tmpfs = Y2Storage::Planned::Tmpfs.new(mount, [])
        add_planned_attributes(tmpfs, attrs)
      end

      def add_planned_attributes(device, attrs)
        attrs = attrs.dup

        if device.respond_to?(:filesystem_type)
          type = attrs.delete(:type)
          device.filesystem_type =
            if type.is_a?(::String) || type.is_a?(Symbol)
              Y2Storage::Filesystems::Type.const_get(type.to_s.upcase)
            else
              type
            end
        end

        attrs.each_pair do |key, value|
          device.send(:"#{key}=", value)
        end
        device
      end

      def create_thin_provisioning(vg) # rubocop:disable Naming/MethodParameterName
        pool1 = vg.create_lvm_lv("pool1", Y2Storage::LvType::THIN_POOL, Y2Storage::DiskSize.GiB(1))
        pool2 = vg.create_lvm_lv("pool2", Y2Storage::LvType::THIN_POOL, Y2Storage::DiskSize.GiB(1))
        pool1.create_lvm_lv("thin1", Y2Storage::LvType::THIN, Y2Storage::DiskSize.GiB(2))
        pool1.create_lvm_lv("thin2", Y2Storage::LvType::THIN, Y2Storage::DiskSize.GiB(2))
        pool2.create_lvm_lv("thin3", Y2Storage::LvType::THIN, Y2Storage::DiskSize.GiB(2))
      end

      # Creates a primary partition in the first free slot of the given disk
      #
      # @param disk [Y2Storage::Partitionable]
      def create_next_partition(disk)
        disk.ensure_partition_table
        slot = disk.partition_table.unused_partition_slots.first
        disk.partition_table.create_partition(slot.name, slot.region, Y2Storage::PartitionType::PRIMARY)
      end

      def space_dist(vols_by_space)
        Y2Storage::Planned::PartitionsDistribution.new(vols_by_space)
      end

      # Shuffles an array in a predictable way by enforcing a known seed.
      #
      # Useful to test sorting while still being able to reproduce errors.
      def shuffle(array)
        array.shuffle(random: Random.new(12345))
      end

      # Simple helper to mock the environment variables
      #
      # @param hash [Hash] mocked environment variables and their values
      def mock_env(hash)
        allow(ENV).to receive(:[]) do |key|
          hash[key]
        end
        allow(ENV).to receive(:keys).and_return hash.keys
        # reset the ENV cache
        Y2Storage::StorageEnv.instance.send(:initialize)
      end

      # Dups strings (including strings nested one level deep inside an Array), since some
      # production code (e.g. StorageClassWrapper.object_for) calls #force_encoding on them,
      # which would raise FrozenError on a frozen string literal
      def dup_strings(values)
        values.map do |v|
          case v
          when ::String then v.dup
          when ::Array then v.map { |e| e.is_a?(::String) ? e.dup : e }
          else v
          end
        end
      end

      def fstab_entry(*values)
        values = dup_strings(values)

        storage_entry = instance_double(Storage::SimpleEtcFstabEntry,
          device:        values[0],
          mount_point:   values[1],
          fs_type:       values[2].to_i,
          mount_options: values[3],
          fs_freq:       values[4],
          fs_passno:     values[5])

        Y2Storage::SimpleEtcFstabEntry.new(storage_entry)
      end

      def crypttab_entry(*values)
        values = dup_strings(values)

        storage_entry = instance_double(Storage::SimpleEtcCrypttabEntry,
          name:          values[0],
          device:        values[1],
          password:      values[2],
          crypt_options: values[3])

        Y2Storage::SimpleEtcCrypttabEntry.new(storage_entry)
      end

      def stub_product_features(features)
        Yast::ProductFeatures.Import(features)
      end

      # Double for a APQN (used in pervasive encryption)
      def apqn_mock(name, master_key, ep11: false)
        instance_double(
          Y2Storage::EncryptionProcesses::Apqn, name: name, master_key_pattern: master_key, ep11?: ep11
        )
      end
    end
    # rubocop:enable all
  end
end
