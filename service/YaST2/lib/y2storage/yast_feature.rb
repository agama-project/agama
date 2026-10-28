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

require "yast"
require "y2storage/feature"
require "yast2/equatable"

module Y2Storage
  # Analogous to {StorageFeature}, but for requirements originated by Y2Storage and not
  # from libstorage-ng.
  class YastFeature < Feature
    include Yast2::Equatable

    eql_attr :id

    # Constructor
    def initialize(id, mandatory_pkgs, optional_pkgs)
      pkgs = mandatory_pkgs.map { |pkg| Package.new(pkg, optional: false) }
      pkgs.concat(optional_pkgs.map { |pkg| Package.new(pkg, optional: true) })
      super(id, pkgs)
    end

    # Instance of the feature to be always returned by the class
    ENCRYPTION_TPM_FDE = new(:encryption_tpm_fde, ["fde-tools"], [])

    # All possible instances
    ALL = [ENCRYPTION_TPM_FDE].freeze
    private_constant :ALL

    # Sorted list of all features defined by YaST
    def self.all
      ALL.dup
    end

    # Drop the cache of packages for all known YaST features
    #
    # This is only ever needed if the available packages might have changed
    # since the last use of this class.
    def self.drop_cache
      all.each(&:drop_cache)
    end
  end
end
