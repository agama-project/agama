# Copyright (c) [2015-2017] SUSE LLC
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
require "y2storage"
require "y2storage/abstract_device_factory"

module Y2Storage
  #
  # Factory class to generate faked devices in a device graph.
  # This is typically used with a YAML file.
  # Use the inherited load_yaml_file() to start the process.
  #
  # rubocop:disable Metrics/ClassLength
  #
  class FakeDeviceFactory < AbstractDeviceFactory
    # Valid toplevel products of this factory
    VALID_TOPLEVEL  = ["dasd", "disk", "md", "lvm_vg"]

    # Valid hierarchy within the products of this factory.
    # This indicates the permitted children types for each parent.
    VALID_HIERARCHY =
      {
        "dasd"       => ["partition_table", "partitions", "file_system", "encryption"],
        "disk"       => ["partition_table", "partitions", "file_system", "encryption"],
        "md"         => ["md_devices", "partition_table", "partitions", "file_system", "encryption"],
        "md_devices" => ["md_device"],
        "md_device"  => [],
        "partitions" => ["partition", "free"],
        "partition"  => ["file_system", "encryption", "btrfs"],
        "encryption" => ["file_system"],
        "lvm_vg"     => ["lvm_lvs", "lvm_pvs"],
        "lvm_lvs"    => ["lvm_lv"],
        "lvm_lv"     => ["file_system", "encryption", "btrfs"],
        "lvm_pvs"    => ["lvm_pv"],
        "lvm_pv"     => [],
        "btrfs"      => ["subvolumes"],
        "subvolumes" => ["subvolume"]
      }

    # Valid parameters for file_system
    FILE_SYSTEM_PARAM = [
      "mount_point", "label", "uuid", "fstab_options", "btrfs", "mount_by", "mkfs_options"
    ]

    # Valid parameters for each product of this factory.
    # Sub-products are not listed here.
    VALID_PARAM =
      {
        "dasd"            => [
          "name", "size", "block_size", "io_size", "min_grain", "align_ofs", "type", "format"
        ].concat(FILE_SYSTEM_PARAM),
        "disk"            => [
          "name", "size", "block_size", "io_size", "min_grain", "align_ofs", "mbr_gap"
        ].concat(FILE_SYSTEM_PARAM),
        "md"              => [
          "name", "md_level", "md_parity", "chunk_size", "md_uuid", "in_etc_mdadm", "metadata"
        ].concat(FILE_SYSTEM_PARAM),
        "md_device"       => ["blk_device"],
        "partition_table" => [],
        "partitions"      => [],
        "partition"       => [
          "size", "start", "align", "name", "type", "id"
        ].concat(FILE_SYSTEM_PARAM),
        "file_system"     => [],
        "encryption"      => ["name", "type", "password", "pbkdf", "authentication"],
        "free"            => ["size", "start"],
        "lvm_vg"          => ["vg_name", "extent_size"],
        "lvm_lv"          => [
          "lv_name", "size", "stripes", "stripe_size"
        ].concat(FILE_SYSTEM_PARAM),
        "lvm_pv"          => ["blk_device"],
        "btrfs"           => ["default_subvolume"],
        "subvolumes"      => [],
        "subvolume"       => ["path", "nocow"]
      }

    # Dependencies between products on the same hierarchy level.
    DEPENDENCIES =
      {
        # file_system depends on encryption because any encryption needs to be
        # created first (and then the file system on the encryption layer).
        #
        # file_system depends on partition_table so a partition table is
        # created before any file_system directly on a disk so an error can be
        # reported if both are specified: It's either a partiton table or a
        # file system, not both.
        #
        # file_system depends on md_devices because the devices must be added to
        # the MD before formatting it.
        "file_system"     => ["encryption", "partition_table", "md_devices"],

        # partition_table depends on "md_devices" because the devices must be added
        # to the MD before creating partitions on it.
        "partition_table" => ["md_devices"]
      }

    class << self
      #
      # Read a YAML file and build a fake device tree from it.
      #
      # This is a singleton method for convenience. It creates a
      # FakeDeviceFactory internally for one-time usage. If you use this more
      # often (for example, in a loop), it is recommended to use create a
      # FakeDeviceFactory and use its load_yaml_file() method repeatedly.
      #
      # @param devicegraph [Devicegraph] where to build the tree
      # @param input_file [String] name of the YAML file
      #
      def load_yaml_file(devicegraph, input_file)
        factory = FakeDeviceFactory.new(devicegraph)
        factory.load_yaml_file(input_file)
      end
    end

    def initialize(devicegraph)
      super(devicegraph)
      @disks = Set.new
      @file_system_data = {}
    end

    protected

    # Return a hash for the valid hierarchy of the products of this factory:
    # Each hash key returns an array (that might be empty) for the child
    # types that are valid below that key.
    #
    # @return [Hash<String, Array<String>>]
    #
    def valid_hierarchy
      VALID_HIERARCHY
    end

    # Return an array for valid toplevel products of this factory.
    #
    # @return [Array<String>] valid toplevel products
    #
    def valid_toplevel
      VALID_TOPLEVEL
    end

    # Return an hash of valid parameters for each product type of this
    # factory. This does not include sub-products, only the parameters that
    # are passed directly to each individual product.
    #
    # @return [Hash<String, Array<String> >]
    #
    def valid_param
      VALID_PARAM
    end

    # Fix up parameters to the create_xy() methods.  In this instance,
    # this is used to convert parameters representing a DiskSize to a
    # DiskSize object that can be used directly.
    #
    # This method is optional. The base class checks with respond_to? if it
    # is implemented before it is called.
    #
    # @param name [String] factory product name
    # @param param [Hash] create_xy() parameters
    #
    # @return [Hash or Scalar] changed parameters
    #
    def fixup_param(name, param)
      log.info("Fixing up #{param} for #{name}")
      ["size", "start", "block_size", "io_size", "min_grain", "align_ofs",
       "mbr_gap", "extent_size", "stripe_size", "chunk_size"].each do |key|
        param[key] = DiskSize.new(param[key]) if param.key?(key)
      end
      param
    end

    # Return a hash describing dependencies from one sub-product (on the same
    # hierarchy level) to another so they can be produced in the correct order.
    #
    # For example, if there is an encryption layer and a file system in a
    # partition, the encryption layer needs to be created first so the file
    # system can be created inside that encryption layer.
    #
    def dependencies
      DEPENDENCIES
    end

    # Factory methods
    #
    # The AbstractDeviceFactory base class will collect all methods starting
    # with "create_" via Ruby introspection (methods()) and use them for
    # creating factory products.
    #

    # Factory method to create a DASD disk.
    #
    # @param _parent [nil] (disks are toplevel)
    # @param args [Hash] disk parameters:
    #   "name"       device name ("/dev/sda" etc.)
    #   "size"       disk size
    #   "block_size" block size
    #   "io_size"    optimal io size
    #   "min_grain"  minimal grain
    #   "align_ofs"  alignment offset
    #   "type"       DASD type ("eckd", "fba")
    #   "format"     DASD format ("ldl", "cdl")
    #
    # @return [String] device name of the new DASD disk ("/dev/sda" etc.)
    def create_dasd(_parent, args)
      dasd_args = add_defaults_for_dasd(args)
      dasd = new_partitionable(Dasd, dasd_args)
      type = fetch(DasdType, dasd_args["type"], "dasd type", dasd_args["name"])
      format = fetch(DasdFormat, dasd_args["format"], "dasd format", dasd_args["name"])
      dasd.type = type unless type.is?(:unknown)
      dasd.format = format unless format.is?(:none)
      dasd.name
    end

    def add_defaults_for_dasd(args)
      dasd_args = args.dup
      dasd_args["name"] ||= "/dev/dasda"
      dasd_args["type"] ||= "unknown"
      dasd_args["format"] ||= "none"
      if dasd_args["type"] == "eckd"
        dasd_args["block_size"] ||= DiskSize.KiB(4)
        dasd_args["min_grain"] ||= DiskSize.KiB(4)
      end
      dasd_args
    end

    # Factory method to create a disk.
    #
    # @param _parent [nil] (disks are toplevel)
    # @param args [Hash] disk parameters:
    #   "name"       device name ("/dev/sda" etc.)
    #   "size"       disk size
    #   "range"      max number of partitions
    #   "block_size" block size
    #   "io_size"    optimal io size
    #   "min_grain"  minimal grain
    #   "align_ofs"  alignment offset
    #   "mbr_gap"    mbr gap (for msdos partition table)
    #
    # @return [String] device name of the new disk ("/dev/sda" etc.)
    def create_disk(_parent, args)
      new_partitionable(Disk, args).name
    end

    # Factory method to create a Software RAID (Md)
    #
    # @param _parent [nil] (Mds are toplevel)
    # @param args [Hash] RAID parameters:
    #   * :name [String] RAID name (e.g., /dev/md0)
    #   * :md_level [String] "raid0", "raid1", etc
    #   * :chunk_size [DiskSize]
    #   * :md_uuid [String]
    #   * :in_etc_mdadm [Boolean]
    #   * :metadata [String]
    #
    # @return [String] name of the new Software RAID (e.g., /dev/md0)
    def create_md(_parent, args)
      name = args["name"] || Md.find_free_numeric_name(devicegraph)
      md = Md.create(devicegraph, name)
      add_md_attributes(md, args)

      save_filesystem_attributes(md, args)
      md.name
    end

    # Sets attributes values to the recently created Software RAID
    #
    # @param md [Y2Stroage::Md]
    # @param args [Hash] RAID parameters:
    def add_md_attributes(md, args)
      add_md_level(md, args["md_level"])
      add_md_parity(md, args["md_parity"])
      add_md_chunk_size(md, args["chunk_size"])
      add_md_uuid(md, args["md_uuid"])
      add_md_in_etc_mdamd(md, args["in_etc_mdadm"])
      add_md_metadata(md, args["metadata"])
    end

    # Sets the MD RAID level (RAID0 by defaul)
    #
    # @param md [Y2Stroage::Md]
    # @param level [String, nil]
    def add_md_level(md, level)
      level = Y2Storage::MdLevel.find(level) unless level.nil?
      level ||= Y2Storage::MdLevel::RAID0

      md.md_level = level
    end

    # Sets the MD RAID parity algorithm
    #
    # @param md [Y2Stroage::Md]
    # @param parity [String, nil]
    def add_md_parity(md, parity)
      return if parity.nil?

      parity = Y2Storage::MdParity.find(parity)
      md.md_parity = parity
    end

    # Sets the MD RAID chunk size
    #
    # @param md [Y2Stroage::Md]
    # @param chunk_size [Y2Storage::DiskSize, nil]
    def add_md_chunk_size(md, chunk_size)
      return if chunk_size.nil?

      md.chunk_size = chunk_size
    end

    # Sets the MD RAID uuid
    #
    # @note Public Md API (wrapper) does not allow to set this value because
    #   this value should only be probed.
    #
    # @param md [Y2Stroage::Md]
    # @param uuid [String, nil]
    def add_md_uuid(md, uuid)
      return if uuid.nil?

      md.to_storage_value.uuid = uuid
    end

    # Sets the MD RAID "in_etc_mdadm" value
    #
    # @param md [Y2Stroage::Md]
    # @param in_etc_mdadm [Boolean, nil]
    def add_md_in_etc_mdamd(md, in_etc_mdadm)
      return if in_etc_mdadm.nil?

      md.to_storage_value.in_etc_mdadm = in_etc_mdadm
    end

    # Sets the MD RAID metadata
    #
    # @note Public Md API (wrapper) does not allow to set this value because
    #   this value should only be probed.
    #
    # @param md [Y2Stroage::Md]
    # @param metadata [String, nil]
    def add_md_metadata(md, metadata)
      return if metadata.nil?

      md.to_storage_value.metadata = metadata
    end

    # Factory method to add a block device to a Software RAID
    #
    # @param parent [Md] Software RAID
    # @param args [Hash] block device parameters:
    #   * :blk_device [String] block device used by the Software RAID
    def create_md_device(parent, args)
      md = Md.find_by_name(devicegraph, parent)
      md_device = BlkDevice.find_by_name(devicegraph, args["blk_device"])

      md.add_device(md_device)
    end

    # Method to create a partitionable.
    # @see #create_dasd
    # @see #create_disk
    #
    # @param partitionable_class [Dasd, Disk]
    # @param args [Hash<String, String>]
    #
    # @return [Y2Storage::Partitionable] device
    #
    # FIXME: this method is too complex. It offends three different cops
    # related to complexity.
    # rubocop:disable Metrics/PerceivedComplexity, Metrics/AbcSize
    def new_partitionable(partitionable_class, args)
      @volumes = Set.new
      @free_blob      = nil
      @free_regions   = []
      @mbr_gap        = nil

      log.info("#{__method__}( #{args} )")
      name = args["name"] || "/dev/sda"
      size = args["size"]
      raise ArgumentError, "\"size\" missing for disk #{name}" if size.nil?
      raise ArgumentError, "Duplicate disk name #{name}" if @disks.include?(name)

      @disks << name
      block_size = args["block_size"] if args["block_size"]
      @mbr_gap = args["mbr_gap"] if args["mbr_gap"]
      if block_size && block_size.size > 0
        r = Region.create(0, size.to_i / block_size.to_i, block_size)
        disk = partitionable_class.create(@devicegraph, name, r)
      else
        disk = partitionable_class.create(@devicegraph, name)
        disk.size = size
      end
      set_topology_attributes!(disk, args)
      # range (number of partitions that the kernel can handle) used to be
      # 16 for scsi and 64 for ide. Now it's 256 for most of them.
      disk.range = args["range"] || 256

      save_filesystem_attributes(disk, args)
      disk
    end
    # rubocop:enable all

    # Saves all attributes related to the filesystem when the device is directly formatted
    #
    # @param device [BlkDevice]
    # @param args [Hash] device and filesystem parameters
    def save_filesystem_attributes(device, args)
      return unless args.keys.any? { |x| FILE_SYSTEM_PARAM.include?(x) }

      # No use trying to check for disk.has_partition_table here and throwing
      # an error in that case: The AbstractDeviceFactory base class will
      # already have caused a Storage::WrongNumberOfChildren exception and
      # convert that into a better readable HierarchyError. When we get here,
      # that error already happened.
      log.info("Creating filesystem directly on device #{args}")
      file_system_data_picker(device.name, args)
    end

    # Modifies topology settings of the disk according to factory arguments
    #
    # @param disk [Disk]
    # @param args [Hash] disk parameters. See {#create_disk}
    def set_topology_attributes!(disk, args)
      io_size = args["io_size"]
      min_grain = args["min_grain"]
      align_ofs = args["align_ofs"]
      disk.topology.optimal_io_size = io_size.size if io_size && io_size.size > 0
      disk.topology.alignment_offset = align_ofs.size if align_ofs
      disk.topology.minimal_grain = min_grain.size if min_grain && min_grain.size > 0
    end

    # Factory method to create a partition table.
    #
    # @param parent [String] disk name ("/dev/sda" etc.)
    # @param args [String] disk label type: "gpt", "ms-dos"
    #
    # @return [String] device name of the disk ("/dev/sda" etc.)
    #
    def create_partition_table(parent, args)
      log.info("#{__method__}( #{parent}, #{args} )")
      disk_name = parent
      ptable_type = str_to_ptable_type(args)
      disk = Partitionable.find_by_name(@devicegraph, disk_name)
      ptable = disk.create_partition_table(ptable_type)
      ptable.minimal_mbr_gap = @mbr_gap if ptable.respond_to?(:minimal_mbr_gap=) && @mbr_gap
      disk_name
    end

    # Partition table type represented by a string
    #
    # @param string [String] usually from a YAML file
    # @return [PartitionTables::Type]
    def str_to_ptable_type(string)
      # Allow different spelling
      string = "msdos" if string.casecmp("ms-dos").zero?
      fetch(PartitionTables::Type, string, "partition table type", "disk_name")
    end

    # Factory method to create a partition.
    #
    # Some of the parameters ("mount_point", "label"...) really belong to the
    # file system which is a separate factory product, but it is more natural
    # to specify this for the partition, so those data are kept
    # in @file_system_data to be picked up in create_file_system when needed.
    #
    # @param parent [String] disk name ("/dev/sda" etc.)
    #
    # @param args [Hash] partition table parameters:
    #   "size"  partition size (unlimited if missing)
    #   "start" partition start (optional)
    #   "align" partition align policy (optional)
    #   "name"  device name ("/dev/sdb3" etc.)
    #   "type"  "primary", "extended", "logical"
    #   "id"
    #   "mount_point"   mount point for the associated file system
    #   "label"         file system label
    #   "uuid"          file system UUID
    #   "fstab_options" /etc/fstab options for the file system
    #
    # @return [String] device name of the disk ("/dev/sda" etc.)
    #
    # FIXME: this method is too complex. It offends four different cops
    # related to complexity.
    # rubocop:disable Metrics/PerceivedComplexity, Metrics/CyclomaticComplexity
    # rubocop:disable  Metrics/MethodLength, Metrics/AbcSize
    def create_partition(parent, args)
      log.info("#{__method__}( #{parent}, #{args} )")
      disk_name = parent
      size      = args["size"] || DiskSize.unlimited
      start     = args["start"]
      part_name = args["name"]
      type      = args["type"] || "primary"
      id        = args["id"] || "linux"
      align     = args["align"]

      raise ArgumentError, "\"name\" missing for partition #{args} on #{disk_name}" unless part_name
      raise ArgumentError, "Duplicate partition #{part_name}" if @volumes.include?(part_name)

      @volumes << part_name
      file_system_data_picker(part_name, args)

      id = id.to_i(16) if id.is_a?(::String) && id.start_with?("0x")
      id   = fetch(PartitionId,   id,   "partition ID",   part_name) unless id.is_a?(Integer)
      type = fetch(PartitionType, type, "partition type", part_name)
      align = fetch(AlignPolicy,  align, "align policy",  part_name) if align

      disk = Partitionable.find_by_name(devicegraph, disk_name)
      ptable = disk.partition_table
      slots = ptable.unused_partition_slots

      # partitions are created in order, so first suitable slot should be fine
      # note: skip areas we marked as empty
      slot = slots.find { |s| s.possible?(type) && !@free_regions.member?(s.region.start) }
      raise ArgumentError, "No suitable slot for partition #{part_name}" if !slot

      region = slot.region

      # region = slots.first.region
      # if no start has been specified, take free region into account
      if !start && @free_blob
        @free_regions.push(region.start)
        start_block = region.start + (@free_blob.to_i / region.block_size.to_i)
      end
      @free_blob = nil

      # if start has been specified, use it
      start_block = start.to_i / region.block_size.to_i if start

      # adjust start block, if necessary
      if start_block
        if start_block > region.start && start_block <= region.end
          region.adjust_length(region.start - start_block)
        end
        region.start = start_block
      end

      # if no size has been specified, use whole region
      region.length = size.to_i / region.block_size.to_i if !size.unlimited?

      # align partition if specified
      region = disk.topology.align(region, align) if align

      raise Error, "Trying to create a zero-size partition" if region.empty?

      partition = ptable.create_partition(part_name, region, type)
      partition.id = id

      part_name
    end
    # rubocop:enable all

    # Factory method to create a file system.
    #
    # This fetches some parameters from @file_system_data:
    # "mount_point", "label", "uuid", "encryption"
    #
    # @param parent [String] parent (partition or disk) device name ("/dev/sdc2")
    # @param args   [String] file system type ("xfs", "btrfs", ...)
    #
    # @return [String] partition device name ("/dev/sdc2" etc.)
    #
    def create_file_system(parent, args)
      log.info("#{__method__}( #{parent}, #{args} )")
      fs_type = fetch(Filesystems::Type, args, "file system type", parent)

      # Fetch file system related parameters stored by create_partition()
      fs_param = @file_system_data[parent] || {}
      encryption = fs_param["encryption"]

      if !encryption.nil?
        log.info("file system is on encrypted device #{encryption}")
        parent = encryption
      end
      blk_device = BlkDevice.find_by_name(@devicegraph, parent)
      file_system = blk_device.create_blk_filesystem(fs_type)
      assign_file_system_params(file_system, fs_param)
      parent
    end

    def assign_file_system_params(file_system, fs_param)
      ["label", "uuid", "mkfs_options"].each do |param|
        value = fs_param[param]
        file_system.public_send(:"#{param}=", value) if value
      end

      add_mount_point(file_system, fs_param)
    end

    def add_mount_point(filesystem, fs_param)
      mount_path = fs_param["mount_point"]
      return if mount_path.nil? || mount_path.empty?

      mount_point = filesystem.create_mount_point(mount_path)

      mount_options = fs_param["fstab_options"]
      mount_point.mount_options = mount_options unless mount_options.nil?

      if fs_param["mount_by"]
        mount_point.mount_by = fetch(
          Filesystems::MountByType, fs_param["mount_by"], "mount by name schema", mount_point
        )
      end

      nil
    end

    # Picks some parameters that are really file system related from args
    # and places them in @file_system_data to be picked up later by
    # create_file_system.
    #
    # @param [String] name of blk_device file system is on
    #
    # @param args [Hash] hash with data from yaml file
    #
    def file_system_data_picker(name, args)
      fs_param = FILE_SYSTEM_PARAM << "encryption"
      @file_system_data[name] = args.select { |k, _v| fs_param.include?(k) }
    end

    # Factory method to create a slot of free space.
    #
    # We just remember the value and take it into account when we create the next partition.
    #
    # @param parent [String] disk name ("/dev/sda" etc.)
    #
    # @param args [Hash] free space parameters:
    #   "size"  free space size
    #   "start" (ignored)
    #
    # @return [String] device name of the disk ("/dev/sda" etc.)
    #
    def create_free(parent, args)
      log.info("#{__method__}( #{parent}, #{args} )")
      disk_name = parent
      size = args["size"]
      @free_blob = size if size && size.to_i > 0
      disk_name
    end

    ENCRYPTION_METHOD_ALIASES = {
      "luks" => "luks1"
    }.freeze
    private_constant :ENCRYPTION_METHOD_ALIASES
    # Factory method to create an encryption layer.
    #
    # @param parent [String] parent device name ("/dev/sda1" etc.)
    #
    # @param args [Hash] encryption layer parameters:
    #   "name"     name encryption layer ("/dev/mapper/cr_Something")
    #   "type"     encryption type; default: "luks"
    #   "password" encryption password (optional)
    #
    # @return [Object] new encryption object
    #
    def create_encryption(parent, args)
      log.info("#{__method__}( #{parent}, #{args} )")
      name = encryption_name(args["name"], parent)
      password = args["password"]
      type_name = args["type"] || "luks"
      type_name = ENCRYPTION_METHOD_ALIASES[type_name] if ENCRYPTION_METHOD_ALIASES.key?(type_name)
      # We only support creating LUKS so far
      method = EncryptionMethod.find(type_name)
      raise ArgumentError, "Unsupported encryption type #{type_name}" unless method

      blk_parent = BlkDevice.find_by_name(@devicegraph, parent)
      encryption = blk_parent.encrypt(dm_name: name, password: password, method: method)
      if @file_system_data.key?(parent)
        # Notify create_file_system that this partition is encrypted
        @file_system_data[parent]["encryption"] = encryption.name
      end

      name = args["pbkdf"]
      if name
        pbkdf = PbkdFunction.find(name)
        raise ArgumentError, "Unsupported pbkdf type #{name}" unless pbkdf

        encryption.pbkdf = pbkdf
      end
      name = args["authentication"]
      if name
        authentication = EncryptionAuthentication.find(name)
        unless authentication
          raise ArgumentError,
            "Unsupported authentication #{name}"
        end
        encryption.authentication = authentication
      end

      encryption
    end

    def encryption_name(name, parent)
      return nil if name.nil? || name.empty?

      if name.include?("/")
        processed_encryption_name(name, parent)
      else
        name
      end
    end

    # DeviceMapper name for a given DeviceMapper full path
    def processed_encryption_name(name, parent)
      valid_name = false
      result = nil

      if name.start_with?("/dev/mapper/")
        result = name.split("/").last
        valid_name = !result.nil? && !result.empty?
      end

      if !valid_name
        raise ArgumentError, "Unexpected \"name\" value for encryption on #{parent}: #{name}"
      end

      result
    end

    # Factory method to create a lvm volume group.
    #
    # @param _parent [nil] (volume groups are toplevel)
    # @param args [Hash] volume group parameters:
    #   "vg_name"     volume group name
    #   "extent_size" extent size
    #
    # @return [Object] new volume group object
    #
    def create_lvm_vg(_parent, args)
      log.info("#{__method__}( #{args} )")
      @volumes = Set.new # contains both partitions and logical volumes

      vg_name = args["vg_name"]
      lvm_vg = LvmVg.create(@devicegraph, vg_name)

      extent_size = args["extent_size"] || DiskSize.zero
      lvm_vg.extent_size = extent_size if extent_size.to_i > 0

      lvm_vg
    end

    # Factory method to create a lvm logical volume.
    #
    # Some of the parameters ("mount_point", "label"...) really belong to the
    # file system which is a separate factory product, but it is more natural
    # to specify this for the logical volume, so those data are kept
    # in @file_system_data to be picked up in create_file_system when needed.
    #
    # @param parent [Object] volume group object
    #
    # @param args [Hash] lvm logical volume parameters:
    #   "lv_name"     logical volume name
    #   "size"        partition size
    #   "stripes"     number of stripes
    #   "stripe_size" stripe size
    #   "mount_point"   mount point for the associated file system
    #   "label"         file system label
    #   "uuid"          file system UUID
    #   "fstab_options" /etc/fstab options for the file system
    #
    # @return [String] device name of new logical volume
    #
    def create_lvm_lv(parent, args)
      log.info("#{__method__}( #{parent}, #{args} )")

      lv_name = args["lv_name"]
      raise ArgumentError, "\"lv_name\" missing for lvm_lv #{args} on #{vg_name}" unless lv_name
      raise ArgumentError, "Duplicate lvm_lv #{lv_name}" if @volumes.include?(lv_name)

      @volumes << lv_name

      size = args["size"] || DiskSize.zero
      raise ArgumentError, "\"size\" missing for lvm_lv #{lv_name}" unless args.key?("size")

      lvm_lv = parent.create_lvm_lv(lv_name, size)
      create_lvm_lv_stripe_parameters(lvm_lv, args)

      file_system_data_picker(lvm_lv.name, args)

      lvm_lv.name
    end

    # Helper class for create_lvm_lv handling the stripes related parameters.
    #
    def create_lvm_lv_stripe_parameters(lvm_lv, args)
      stripes = args["stripes"] || 0
      lvm_lv.stripes = stripes if stripes > 0

      stripe_size = args["stripe_size"] || DiskSize.zero
      lvm_lv.stripe_size = stripe_size if stripe_size.to_i > 0
    end

    # Factory method to create a lvm physical volume.
    #
    # @param parent [Object] volume group object
    #
    # @param args [Hash] lvm physical volume parameters:
    #   "blk_device" block device used by physical volume
    #
    # @return [Object] new physical volume object
    #
    def create_lvm_pv(parent, args)
      log.info("#{__method__}( #{parent}, #{args} )")

      blk_device_name = args["blk_device"]
      blk_device = BlkDevice.find_by_name(devicegraph, blk_device_name)

      parent.add_lvm_pv(blk_device)
    end

    # Factory method for a btrfs pseudo object to create subvolumes.
    #
    # @param parent [String] Name of the partition or LVM LV
    #
    # @param args [Hash] btrfs parameters:
    #   "default_subvolume"
    #
    # @return [String] Name of the partition or LVM LV
    #
    def create_btrfs(parent, args)
      log.info("#{__method__}( #{parent}, #{args} )")
      default_subvolume = args["default_subvolume"]
      if default_subvolume && !default_subvolume.empty?
        blk_device = BlkDevice.find_by_name(devicegraph, parent)
        filesystem = blk_device.filesystem
        raise HierarchyError, "No btrfs on #{parent}" if !filesystem || !filesystem.type.is?(:btrfs)

        toplevel = filesystem.top_level_btrfs_subvolume
        subvolume = toplevel.create_btrfs_subvolume(default_subvolume)
        subvolume.set_default_btrfs_subvolume
      end
      parent
    end

    # Factory method for a btrfs subvolume
    #
    # @param parent [String] Name of the partition or LVM LV
    #
    # @param args [Hash] subvolume parameters:
    #   "path"  subvolume path without leading "@" or "/"
    #   "nocow" "no copy on write" attribute (default: false)
    #
    # @return [String] Name of the partition or LVM LV
    #
    def create_subvolume(parent, args)
      log.info("#{__method__}( #{parent}, #{args} )")
      path  = args["path"]
      nocow = args.fetch("nocow", false)
      raise ArgumentError, "No path for subvolume" unless path

      blk_device = BlkDevice.find_by_name(@devicegraph, parent)
      blk_device.filesystem.create_btrfs_subvolume(path, nocow)
    end

    private

    # Fetch an enum value
    # @raise [ArgumentError] if such value is not defined
    #
    # @param klass  [Class] class used to represent the enum
    # @param name   [String] name of the enum value
    # @param type   [String] type (description) of 'key'
    # @param object [String] name of the object that was being processed
    #
    def fetch(klass, name, type, object)
      value = klass.find(name)
      if !value
        available = klass.all.map(&:to_s)
        raise ArgumentError, "Invalid #{type} \"#{name}\" for #{object} - use one of #{available}"
      end
      value
    end
  end
end
