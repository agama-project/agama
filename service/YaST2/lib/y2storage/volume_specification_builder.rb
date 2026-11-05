# Copyright (c) [2018-2021] SUSE LLC
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

require "y2storage/filesystems/type"
require "y2storage/partition_id"
require "y2storage/proposal_settings"

module Y2Storage
  # This class is able to provide a volume specification for a given mount point.
  #
  # If no specification exists for a given mount point, it will try to offer
  # a fallback.
  #
  # @example Volume specification for /boot
  #   builder = VolumeSpecificationBuilder.new
  #   builder.for("/boot")
  #
  # @example Non-existent volume specification
  #   builder = VolumeSpecificationBuilder.new
  #   builder.for("/some/mount/point") #=> nil
  class VolumeSpecificationBuilder
    attr_reader :proposal_settings

    # Constructor
    #
    # @param proposal_settings [ProposalSettings] Proposal settings
    def initialize(proposal_settings = nil)
      @proposal_settings = proposal_settings || Y2Storage::ProposalSettings.new_for_current_product
    end

    # Return a volume specification for a given mount point
    #
    # It will use the volume specification found within the list of volumes
    # in the proposal settings. If it is not found, it will try to propose
    # a fallback.
    #
    # @param mount_point [String] Volume mount point
    # @return [VolumeSpecification] Volume specification; nil if the
    #   specification was not found and no fallback could be proposed.
    def for(mount_point)
      proposal_spec(mount_point) || fallback_spec(mount_point)
    end

    private

    # Return a volume spec from proposal settings for the given mount point
    #
    # @param mount_point [String] Volume mount point
    # @return [VolumeSpecification,nil] Volume specification if found; otherwise,
    #   it returns nil.
    def proposal_spec(mount_point)
      return nil if proposal_settings.volumes.nil?

      proposal_settings.volumes.find { |v| v.mount_point == mount_point }
    end

    # Return a volume spec fallback
    #
    # @param mount_point [String] Volume mount point
    # @return [VolumeSpecification,nil] Volume specification if a suitable fallback
    #   is defined; nil otherwise.
    def fallback_spec(mount_point)
      name = mount_point.sub(/\A\//, "").tr("/", "_")
      meth = "fallback_for_#{name}"
      return send(meth) if respond_to?(meth, true)
    end

    # Volume specification fallback for /boot
    #
    # @return [VolumeSpecification]
    def fallback_for_boot
      VolumeSpecification.new({}).tap do |v|
        v.mount_point = "/boot"
        v.fs_types = Filesystems::Type.root_filesystems
        v.fs_type = Filesystems::Type::EXT4
        v.min_size = DiskSize.MiB(100)
        v.desired_size = DiskSize.MiB(200)
        v.max_size = DiskSize.MiB(500)
      end
    end

    # Volume specification fallback for /boot/efi
    #
    # Regarding sizes, it looks like 256MiB is the minimum size for FAT32 in 4K
    # Native drives (4-KiB-per-sector), according to
    # https://wiki.archlinux.org/index.php/EFI_System_Partition
    #
    # @return [VolumeSpecification]
    def fallback_for_boot_efi
      VolumeSpecification.new({}).tap do |v|
        v.mount_point = "/boot/efi"
        v.fs_types = [Filesystems::Type::VFAT]
        v.fs_type = Filesystems::Type::VFAT
        v.min_size = DiskSize.MiB(128)
        v.desired_size = DiskSize.MiB(256)
        # Note 512MiB seems to be the threshold used by mkfs.vfat to
        # automatically use FAT32 if no FAT size is specified
        v.max_size = DiskSize.MiB(512)
      end
    end

    # Volume specification fallback for /efi
    #
    # @return [VolumeSpecification]
    def fallback_for_efi
      fallback_for_boot_efi.tap do |v|
        v.mount_point = "/efi"
        v.min_size = DiskSize.GiB(1)
        v.desired_size = DiskSize.GiB(1)
        v.max_size = DiskSize.GiB(1)
      end
    end

    # Volume specification fallback for /boot/zipl
    #
    # @return [VolumeSpecification]
    def fallback_for_boot_zipl
      VolumeSpecification.new({}).tap do |v|
        v.mount_point = "/boot/zipl"
        v.fs_types = Filesystems::Type.zipl_filesystems
        v.fs_type = Filesystems::Type.zipl_filesystems.first
        # This partition needs to host Grub2 + one kernel + one initrd
        v.min_size = DiskSize.MiB(100)
        v.desired_size = DiskSize.MiB(200)
        v.max_size = DiskSize.MiB(300)
      end
    end

    # Volume specification fallback for grub partition
    #
    # @return [VolumeSpecification]
    def fallback_for_grub
      VolumeSpecification.new({}).tap do |v|
        # Grub2 with all the modules we could possibly use (LVM, LUKS, etc.)
        # is slightly bigger than 1MiB
        v.min_size = DiskSize.MiB(2)
        v.desired_size = DiskSize.MiB(4)
        v.max_size = DiskSize.MiB(8)
        # Only required on GPT
        v.partition_id = PartitionId::BIOS_BOOT
      end
    end

    # Volume specification fallback for prep partition
    #
    # @return [VolumeSpecification]
    def fallback_for_prep
      # TODO: We have been told that PReP must be one of the first 4
      # partitions, ideally the first one. But we have not found any
      # rationale/evidence. Not implementing that for the time being
      VolumeSpecification.new({}).tap do |v|
        # Grub2 with all the modules we could possibly use (LVM, LUKS, etc.)
        # is slightly bigger than 1MiB
        v.min_size = DiskSize.MiB(2)
        v.desired_size = DiskSize.MiB(4)
        v.max_size = DiskSize.MiB(8)
        # 8 MiB is the maximum recommended size, more than enough for the image (bsc#1081979).
        # If the optimal I/O size of the disk is bigger than 8MiB, the alignment performed by YaST
        # can result in a bigger PReP. That's ok - the firmware in machines with such disks can (and
        # should) be configured to properly read such a partition (see bsc#1192448).
        v.max_size_limit = DiskSize.MiB(8)
        v.partition_id = PartitionId::PREP
      end
    end

    # Volume specification fallback for swap
    #
    # @return [VolumeSpecification]
    def fallback_for_swap
      VolumeSpecification.new({}).tap do |v|
        v.mount_point = "swap"
        v.fs_type = Filesystems::Type::SWAP
        v.min_size = DiskSize.MiB(512)
        v.max_size = DiskSize.GiB(2)
      end
    end
  end
end
