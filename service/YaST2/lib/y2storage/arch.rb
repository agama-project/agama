# Copyright (c) [2019-2020] SUSE LLC
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
require "y2storage/storage_class_wrapper"

module Y2Storage
  # Hardware architecture
  #
  # This is a wrapper for Storage::Arch.
  class Arch
    include StorageClassWrapper

    wrap_class Storage::Arch

    # Wraps the Storage::Arch object passed to it or creates a new
    # Storage::Arch object and wraps that.
    #
    # This also adjusts {#efiboot?} according to the `/etc/install.inf::EFI` setting.
    #
    # @param storage_arch [Storage::Arch] Storage::Arch object to wrap.
    #
    # @return [Y2Storage::Arch]
    def initialize(storage_arch = Storage::Arch.new)
      super(storage_arch)

      Yast.import "Linuxrc"

      return if Yast::Linuxrc.InstallInf("EFI").nil?

      storage_arch.efiboot = Yast::Linuxrc.InstallInf("EFI") == "1"
    end

    # @!method x86?
    #   @return [Boolean] whether the architecture is x86
    storage_forward :x86?

    # @!method ppc?
    #   @return [Boolean] whether the architecture is PowerPC
    storage_forward :ppc?

    # @!method s390?
    #   @return [Boolean] whether the architecture is s390
    storage_forward :s390?

    # @!method efiboot?
    #   @return [Boolean] whether it is an UEFI system
    storage_forward :efiboot?

    # @!method ppc_power_nv?
    #   @return [Boolean] whether it is a Power NV system
    storage_forward :ppc_power_nv?

    # @!method page_size
    #   @return [Integer] the system page size
    storage_forward :page_size

    # @!method efibootmgr?
    #
    # Whether the UEFI boot manager can write UEFI boot entries.
    #
    # Storage::Arch exports it as static function to not break the existing ABI.
    # Make it available as instance method to have a consistent API
    # in {Y2Storage::Arch}.
    #
    # @note This is entirely independent of {#efiboot?}. In particular
    #   overriding {#efiboot?} with environment variables or config files will
    #   have no effect on {#efibootmgr?}.
    #
    # @return [Boolean] whether the UEFI boot manager can write UEFI boot entries
    def efibootmgr?
      to_storage_value.class.efibootmgr?
    end

    # Current RAM size in bytes
    #
    # @note RAM size is read from /proc/meminfo, where sizes are supposed to
    #   be in KiB.
    #
    # @return [Integer] bytes (intead of {DiskSize}) for consistency with {#page_size}
    def ram_size
      1024 * Yast::SCR.Read(Yast::Path.new(".proc.meminfo"))["memtotal"]
    end
  end
end
