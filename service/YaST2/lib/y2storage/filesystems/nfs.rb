# Copyright (c) [2017-2022] SUSE LLC
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

require "y2storage/storage_class_wrapper"
require "y2storage/filesystems/base"
require "y2storage/filesystems/legacy_nfs"

module Y2Storage
  module Filesystems
    # Class to represent a NFS mount.
    #
    # The class does not provide functions to change the server or path since
    # that would create a completely different filesystem.
    #
    # This is a wrapper for Storage::Nfs
    class Nfs < Base
      wrap_class Storage::Nfs

      # @!method server
      #   @return [String]
      storage_forward :server

      # @!method path
      #   @return [String]
      storage_forward :path

      # @!method self.create(devicegraph, server, path)
      #   @param devicegraph [Devicegraph]
      #   @param server [String]
      #   @param path [String]
      #   @return [Nfs]
      storage_class_forward :create, as: "Filesystems::Nfs"

      # @!method self.all(devicegraph)
      #   @param devicegraph [Devicegraph]
      #   @return [Array<Nfs>] all the NFS mounts in the given devicegraph
      storage_class_forward :all, as: "Filesystems::Nfs"

      # @!method self.find_by_server_and_path(devicegraph, server, path)
      #   @param devicegraph [Devicegraph]
      #   @param server [String]
      #   @param path [String]
      #   @return [Filesystems::Nfs] nil if there is no such NFS mount
      storage_class_forward :find_by_server_and_path, as: "Filesystems::Nfs"

      # @return [Boolean]
      def in_network?
        true
      end

      # Whether the remote share is currently accessible
      #
      # @return [Boolean]
      def reachable?
        # This tries to temporarily mount the filesystem if needed and raises an
        # Storage::Exception if that fails
        detect_space_info
        true
      rescue Storage::Exception
        false
      end

      # Representation of this NFS mount in the hash-based format used before
      # storage-ng (based on the so-called TargetMap)
      #
      # This method is useful to re-use code that still uses the old format in
      # other parts of YaST (like yast2-nfs-client).
      #
      # @return [Hash]
      def to_legacy_hash
        LegacyNfs.new_from_nfs(self).to_hash
      end

      # @see LegacyNfs#legacy_version?
      #
      # @return [Boolean]
      def legacy_version?
        LegacyNfs.new_from_nfs(self).legacy_version?
      end

      def version
        LegacyNfs.new_from_nfs(self).version
      end

      # String representing the remote NFS share in the most common format (the
      # "server:/path/in/server" one used in /etc/fstab)
      #
      # @return [String]
      def share
        "#{server}:#{path}"
      end

      alias_method :name, :share

      # @see Filesystems::Base#match_fstab_spec?
      def match_fstab_spec?(spec)
        spec.chomp("/") == share.chomp("/")
      end

      protected

      # @see Device#is?
      def types_for_is
        super << :nfs
      end
    end
  end
end
