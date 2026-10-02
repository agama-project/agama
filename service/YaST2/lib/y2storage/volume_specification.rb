# Copyright (c) [2017-2024] SUSE LLC
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
require "y2storage/partitioning_features"
require "y2storage/subvol_specification"
require "y2storage/equal_by_instance_variables"

Yast.import "Kernel"

module Y2Storage
  # Helper class to represent a volume specification as defined in control.xml
  class VolumeSpecification
    include PartitioningFeatures
    include EqualByInstanceVariables

    # @return [PartitionId] when the volume needs to be a partition with a specific id
    attr_accessor :partition_id

    # @return [String] directory where the volume will be mounted in the system
    attr_accessor :mount_point

    # @return [String] mount options, separated by comma
    attr_accessor :mount_options

    # @return [Boolean] whether this volume should be created or skipped
    attr_accessor :proposed

    # @return [Boolean] whether the user can change the proposed setting in the UI
    attr_accessor :proposed_configurable

    # @return [Filesystems::Type] default file system type to format the volume
    attr_reader :fs_type

    # @return [List<Filesystems::Type>] acceptable filesystem types
    attr_reader :fs_types

    # @return [DiskSize] initial size to use in the first proposal attempt
    attr_accessor :desired_size

    # @return [DiskSize] initial size to use in the second proposal attempt
    attr_accessor :min_size

    # @return [DiskSize] maximum size to assign to the volume
    attr_accessor :max_size

    # @return [DiskSize] technical size limit; a volume larger than this is not usable
    attr_accessor :max_size_limit

    # @return [DiskSize] when LVM is used, this option can be used to override
    #   the value at max_size
    attr_accessor :max_size_lvm

    # @return [Numeric] value used to distribute the extra space (after assigning
    #   the initial ones) among the volumes
    attr_accessor :weight

    # @return [Boolean] whether the initial and max sizes of each attempt should be
    #   adjusted based in the RAM size
    attr_accessor :adjust_by_ram

    # @return [Boolean] whether the user can change the adjust_by_ram setting in the UI
    attr_accessor :adjust_by_ram_configurable

    # @return [String] mount point of another volume
    attr_accessor :fallback_for_min_size

    # @return [String] mount point of another volume
    attr_accessor :fallback_for_desired_size

    # @return [String] mount point of another volume
    attr_accessor :fallback_for_max_size

    # @return [String] mount point of another volume
    attr_accessor :fallback_for_max_size_lvm

    # @return [String] mount point of another volume
    attr_accessor :fallback_for_weight

    # @return [Boolean] whether snapshots should be activated
    attr_accessor :snapshots

    # @return [Boolean] whether the user can change the snapshots setting in the UI
    attr_accessor :snapshots_configurable

    # @note snaphots_size and snapshots_percentage are exclusive in the control file.
    # @return [DiskSize] the initial and maximum sizes for the volume will be
    #   increased according if snapshots are being used.
    attr_accessor :snapshots_size

    # @note snaphots_size and snapshots_percentage are exclusive in the control file.
    # @return [Integer] the initial and maximum sizes for the volume will be
    #   increased according if snapshots are being used. It represents a percentage
    #   of the original sizes.
    attr_accessor :snapshots_percentage

    # @return [Array<SubvolSpecification>] list of specifications (usually read
    #   from the control file) that will be used to plan the Btrfs subvolumes
    attr_accessor :subvolumes

    # @return [String] default btrfs subvolume path
    attr_accessor :btrfs_default_subvolume

    # @return [Boolean] whether the volume should be mounted as read-only
    attr_accessor :btrfs_read_only

    # @return [Numeric] order to disable volumes if needed to make the initial proposal
    attr_accessor :disable_order

    # Name of a separate LVM volume group that will be created to host only this volume,
    # if the option separate_vgs is active in the settings
    #
    # Only one PV will be created to back the volume group, unlike the default
    # "system" volume group that may be defined on top of several physical
    # volumes if needed.
    #
    # In the future we may consider to break both aspects in different settings.
    # #vg_name to specify the volume group name (with "system" as default) and
    # #isolated_vg to enforce just one PV for a particular volume group.
    #
    # If that ever happens, separate_vg_name=foo would become some kind of alias
    # for vg_name=foo + isolated_vg=true.
    #
    # @return [String]
    attr_accessor :separate_vg_name

    # Optional device name of the disk (DiskDevice to be precise) in which the volume
    # must be located.
    #
    # @return [String, nil]
    attr_accessor :device

    # Name of an existing device that will be used to allocate the filesystem described by
    # this volume.
    #
    # If this field is used, no new device will be created. As a consequence, many of the other
    # attributes (eg. those about sizes and weights) could be ignored.
    #
    # @return [String]
    attr_accessor :reuse_name

    # Whether a reused device should be formatted.
    #
    # If set to false, the existing filesystem should be kept.
    #
    # Only relevant if #reuse_name points to an existing device
    #
    # @return [Boolean]
    attr_accessor :reformat

    # Whether to ignore the fact that this volume is the fallback for the sizes of other volumes
    # (ie. is referenced at any #fallback_for_min_size, #fallback_for_desired_size,
    # #fallback_for_max_size or #fallback_for_max_size_lvm).
    #
    # @return [Boolean] true to indicate the absence of other volumes will not affect the size
    #   calculation of this one
    attr_accessor :ignore_fallback_sizes

    # Whether to ignore any possible effect on the size derived from (de)activating snapshots.
    #
    # @return [Boolean] true if #snapshots_size and #snapshots_percentage should be ignored
    attr_accessor :ignore_snapshots_sizes

    # Whether to ignore any possible effect on the size derived from RAM size
    #
    # @return [Boolean] true if #adjust_by_ram should be ignored
    attr_accessor :ignore_adjust_by_ram

    alias_method :proposed?, :proposed
    alias_method :proposed_configurable?, :proposed_configurable
    alias_method :adjust_by_ram?, :adjust_by_ram
    alias_method :adjust_by_ram_configurable?, :adjust_by_ram_configurable
    alias_method :ignore_adjust_by_ram?, :ignore_adjust_by_ram
    alias_method :snapshots?, :snapshots
    alias_method :snapshots_configurable?, :snapshots_configurable
    alias_method :ignore_snapshots_sizes?, :ignore_snapshots_sizes
    alias_method :ignore_fallback_sizes?, :ignore_fallback_sizes
    alias_method :btrfs_read_only?, :btrfs_read_only
    alias_method :reformat?, :reformat

    class << self
      # Returns the volume specification for the given mount point
      #
      # This method keeps a cache of already calculated volume specifications.
      # Call {.clear_cache} method in order to clear it. Beware that the cache
      # does not take into account that different proposal settings are being
      # used.
      #
      # @param mount_point       [String] Volume's mount point
      # @param proposal_settings [ProposalSettings] Proposal settings
      # @return [VolumeSpecification,nil] Volume specification or nil if not found
      def for(mount_point, proposal_settings: nil)
        clear_cache unless @cache
        @cache[mount_point] ||= VolumeSpecificationBuilder.new(proposal_settings).for(mount_point)
      end

      # Clear volume specifications cache
      def clear_cache
        @cache = {}
      end
    end

    # Constructor
    #
    # @param volume_features [Hash] features for a volume
    def initialize(volume_features)
      apply_defaults
      load_features(volume_features)
      adjust_features
    end

    # @see #fs_type
    #
    # @param type [Filesystems::Type, String]
    def fs_type=(type)
      @fs_type = validated_fs_type(type)
    end

    # @param types [Array<String>, String] an array of filesystem types or a
    #   list of comma-separated ones
    def fs_types=(types)
      types = types.strip.split(/\s*,\s*/) if types.is_a?(String)
      @fs_types = types.map { |t| validated_fs_type(t) }
    end

    # Whether the user can configure some aspect of the volume
    #
    # Returns false if there is no chance for the volume to be proposed or if
    # none of its attributes can be configured by the user.
    #
    # @return [Boolean]
    def configurable?
      return false if !proposed && !proposed_configurable?

      proposed_configurable? ||
        adjust_by_ram_configurable? ||
        snapshots_configurable? ||
        fs_type_configurable?
    end

    # Checks whether #fs_type can be configured by the user
    #
    # @return [Boolean]
    def fs_type_configurable?
      fs_types.size > 1
    end

    # Whether this volume is expected to reuse an existing device
    #
    # @return [Boolean]
    def reuse?
      !(reuse_name.nil? || reuse_name.empty?)
    end

    # Whether the resulting device will be mounted as root
    #
    # @return [Boolean]
    def root?
      mount_point && mount_point == "/"
    end

    # Whether the resulting device will be mounted as swap
    #
    # @return [Boolean]
    def swap?
      mount_point && mount_point == "swap"
    end

    # Whether this volume defines a {#separate_vg_name}
    #
    # @return [Boolean]
    def separate_vg?
      !!separate_vg_name
    end

    # Min size taking into account snapshots requirements
    #
    # @note If there are no special size requirements for snapshots, the
    #   min size is returned.
    #
    # @return [Y2Storage::DiskSize]
    def min_size_with_snapshots
      if snapshots_size > DiskSize.zero
        min_size + snapshots_size
      elsif snapshots_percentage > 0
        multiplicator = 1.0 + (snapshots_percentage / 100.0)
        min_size * multiplicator
      else
        min_size
      end
    end

    # Whether snapper configuration should be activated by default when applying
    # this specification to a given block device
    #
    # @param device [Y2Storage::BlkDevice]
    # @return [Boolean]
    def snapper_for_device?(device)
      if snapshots
        if snapshots_configurable # maybe check also disable_order
          device.size >= min_size_with_snapshots
        else
          true
        end
      else
        false
      end
    end

    # Whether it makes sense to enlarge the volume to suspend
    #
    # This only makes sense when the volume is for swap and the architecture supports to resume from
    # swap.
    #
    # @return [Boolean]
    def enlarge_for_resume_supported?
      swap? && resume_supported?
    end

    private

    FEATURES = {
      mount_point:                :string,
      mount_options:              :string,
      proposed:                   :boolean,
      proposed_configurable:      :boolean,
      fs_types:                   :list,
      fs_type:                    :string,
      adjust_by_ram:              :boolean,
      adjust_by_ram_configurable: :boolean,
      fallback_for_min_size:      :string,
      fallback_for_desired_size:  :string,
      fallback_for_max_size:      :string,
      fallback_for_max_size_lvm:  :string,
      fallback_for_weight:        :string,
      snapshots:                  :boolean,
      snapshots_configurable:     :boolean,
      btrfs_default_subvolume:    :string,
      btrfs_read_only:            :boolean,
      desired_size:               :size,
      min_size:                   :size,
      max_size:                   :size,
      max_size_limit:             :size,
      max_size_lvm:               :size,
      snapshots_size:             :size,
      snapshots_percentage:       :integer,
      weight:                     :integer,
      disable_order:              :integer,
      separate_vg_name:           :string,
      subvolumes:                 :subvolumes
    }.freeze

    private_constant :FEATURES

    def apply_defaults
      @proposed                   = true
      @proposed_configurable      = false
      @desired_size               = DiskSize.zero
      @min_size                   = DiskSize.zero
      @max_size                   = DiskSize.unlimited
      @max_size_limit             = DiskSize.unlimited
      @max_size_lvm               = DiskSize.zero
      @weight                     = 0
      @adjust_by_ram              = false
      @adjust_by_ram_configurable = false
      @snapshots                  = false
      @snapshots_configurable     = false
      @snapshots_size             = DiskSize.zero
      @snapshots_percentage       = 0
      @fs_types                   = []
      @ignore_fallback_sizes      = false
      @ignore_snapshots_sizes     = false
      @ignore_adjust_by_ram       = false
      @reformat                   = true
    end

    # For some features (i.e., fs_types and subvolumes) fallback values could be applied
    # @param volume_features [Hash] features for a volume
    def load_features(volume_features)
      FEATURES.each do |feature, type|
        type = nil if [:string, :boolean, :list].include?(type)
        loader = type.nil? ? "load_feature" : "load_#{type}_feature"
        send(loader, feature, source: volume_features)
      end

      apply_fallbacks
    end

    # Adjusts some features that need to be forced to certain value
    #
    # For example, {#adjust_by_ram} should be set to `false` by default for the swap partition when
    # the architecture does not support to resume from swap (i.e., for s390).
    def adjust_features
      self.adjust_by_ram = false if swap? && !resume_supported?
    end

    def validated_fs_type(type)
      raise(ArgumentError, "Filesystem cannot be nil") unless type
      return type if type.is_a?(Filesystems::Type)

      Filesystems::Type.find(type.downcase.to_sym)
    end

    def apply_fallbacks
      apply_subvolumes_fallback
      apply_fs_types_fallback
    end

    # If subvolumes is missing, a hard-coded list is used for root. If the section is
    # there but empty, no subvolumes are created.
    def apply_subvolumes_fallback
      return unless subvolumes.nil?

      @subvolumes = root? ? SubvolSpecification.fallback_list : []
    end

    # If fs_types is empty, a hard-coded list is used for root and home.
    #
    # @note It always includes fs_type in the list.
    def apply_fs_types_fallback
      if fs_types.empty?
        @fs_types = Filesystems::Type.root_filesystems if mount_point == "/"
        @fs_types = Filesystems::Type.home_filesystems if mount_point == "/home"
      end

      include_fs_type
    end

    # Adds fs_type to the list of possible filesystems
    def include_fs_type
      @fs_types.unshift(fs_type) if fs_type && !fs_types.include?(fs_type)
    end

    # Whether hibernation feature is considered as supported
    #
    # Resuming from swap can be considered as unsupported because of different reasons. For example,
    # because such feature is actually not supported for the current architecture (e.g., s390, Power) or
    # because it does not make much sense to offer such feature (e.g., virtual machines). Moreover, some
    # products can be explicitly configured (with a control file option) to offer hibernation or not.
    #
    # @return [Boolean]
    def resume_supported?
      Yast::Kernel.propose_hibernation?
    end
  end
end
