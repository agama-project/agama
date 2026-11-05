# Copyright (c) [2018] SUSE LLC
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

module Y2Storage
  # Class to represent a fstab file
  class Fstab
    include Yast::Logger

    FSTAB_PATH = "/etc/fstab"
    private_constant :FSTAB_PATH

    # @return [Filesystems::Base]
    attr_reader :filesystem

    # @return [Array<SimpleEtcFstabEntry>]
    attr_reader :entries

    # Constructor
    #
    # @param path [String]
    # @param filesystem [Filesystems::Base]
    def initialize(path = FSTAB_PATH, filesystem = nil)
      @path = path
      @filesystem = filesystem
      @entries = read_entries
    end

    # Fstab entries that represent a filesystem
    #
    # Entries for BTRFS subvolumes are discarded.
    #
    # @return [Array<SimpleEtcFstabEntry>]
    def filesystem_entries
      entries.reject(&:subvolume?)
    end

    # Device where the filesystem is allocated
    #
    # @return [BlkDevice, nil] nil if there is no filesystem or the filesystem is NFS.
    def device
      return nil unless filesystem.respond_to?(:blk_devices)

      filesystem.blk_devices.first
    end

    private

    # @return [String]
    attr_reader :path

    # Reads a fstab file and returns its entries
    #
    # @return [Array<SimpleEtcFstabEntry>]
    def read_entries
      entries = Storage.read_simple_etc_fstab(path)
      entries.map { |e| SimpleEtcFstabEntry.new(e) }
    rescue Storage::Exception
      log.warn("Not possible to read the fstab file: #{path}")
      []
    end
  end
end
