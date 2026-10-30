# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require "y2storage/subvol_specification"

module Y2Storage
  # Enum-like class to represent the possible bootloader types at the configuration
  class BootloaderType
    # Constructor, to be used internally by the class
    #
    # @param value [String] see {#value}
    # @param bls [Boolean] Whether it is a BLS bootloader.
    def initialize(value, bls: false)
      @value = value
      @bls = bls
    end

    # Instance of the bootloader type to be always returned by the class
    GRUB2 = new("grub2")

    # Instance of the bootloader type to be always returned by the class
    SYSTEMD_BOOT = new("systemd-boot", bls: true)

    # Instance of the bootloader type to be always returned by the class
    GRUB2_BLS = new("grub2-bls", bls: true)

    # Instance of the bootloader type to be always returned by the class
    #
    # Special value used to specify a BLS-capable bootloader that must be installed in a way that is
    # backwards compatible with Grub2. Used by YaST to ensure things keep working with its partial
    # and debatable implementation of BLS.
    BLS_LEGACY = new("bls-legacy", bls: true)

    # Instance of the bootloader type to be always returned by the class
    #
    # Special value to specify that no bootloader will be installed.
    NONE = new("none")

    # All possible instances
    ALL = [GRUB2, SYSTEMD_BOOT, GRUB2_BLS, BLS_LEGACY, NONE].freeze
    private_constant :ALL

    # List of all possible types
    def self.all
      ALL.dup
    end

    # Finds a type by its value
    #
    # @param value [#to_s]
    # @return [BootloaderType, nil] nil if such value does not exist
    def self.find(value)
      ALL.find { |type| type.value == value.to_s }
    end

    # @return [String] value to represent the type in the config
    attr_reader :value

    alias_method :to_s, :value

    # @return [Symbol]
    def to_sym
      value.to_sym
    end

    # Whether it is a BLS-compliant bootloader.
    #
    # @see https://uapi-group.org/specifications/specs/boot_loader_specification
    #
    # @return [Boolean]
    def bls?
      !!@bls
    end

    # Checks whether the object corresponds to any of the given enum values.
    #
    # By default, this will be the base comparison used in the case statements.
    #
    # @param names [#to_sym]
    # @return [Boolean]
    def is?(*names)
      names.any? { |n| n.to_sym == to_sym }
    end

    # @return [Boolean]
    def ==(other)
      other.class == self.class && other.value == value
    end

    alias_method :eql?, :==

    # @return [Boolean]
    def ===(other)
      other.instance_of?(self.class) && is?(other)
    end

    # @see #root_subvolumes
    GRUB2_SUBVOLS_DATA = [
      ["boot/grub2/i386-pc", ["i386", "x86_64"]],
      ["boot/grub2/x86_64-efi", ["x86_64"]],
      ["boot/grub2/powerpc-ieee1275", ["ppc", "!board_powernv"]],
      ["boot/grub2/s390x-emu", ["s390"]],
      ["boot/grub2/arm64-efi", ["aarch64"]],
      ["boot/grub2/arm-efi", ["arm"]],
      ["boot/grub2/riscv64-efi", ["riscv64"]]
    ].freeze
    private_constant :GRUB2_SUBVOLS_DATA

    # @see #root_subvolumes
    GRUB2_SUBVOLS = GRUB2_SUBVOLS_DATA.map do |entry|
      SubvolSpecification.new(entry.first, archs: entry.last)
    end.freeze
    private_constant :GRUB2_SUBVOLS

    # Subvolumes that must be created in the root filesystem if Btrfs is used in combination with
    # this bootloader type
    #
    # @return [Array<SubvolSpecification>]
    def root_subvolumes
      return [] unless is?(:grub2)

      GRUB2_SUBVOLS.dup
    end
  end
end
