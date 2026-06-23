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

require "yast"

# :nodoc:
module Yast
  # Replacement for the Yast::Package module.
  class PackageClass < Module
    include Yast::Logger

    def main
      log.info "Loading mocked module #{__FILE__}"
    end

    # Whether a package is available.
    #
    # Agama changes the strategy for adding optional packages to the software proposal:
    #
    # * The traditional YaST strategy consists on checking for the availability of the package and
    #   request it only if the package is available.
    # * In Agama, a package is going to be always considered as available, but it will be requested
    #   as optional package if the package is optional. The software proposal does not install an
    #   optional package if it is not found.
    #
    # With this new approach, the YaST software modules are not called and Agama does not take the
    # libzypp lock (bsc#1268344).
    #
    # @note The package os-prober requires a particular treatment. The logic of yast-bootloader
    # depends on the availability of os-prober. As temporary solution, Agama is going to assume that
    # os-prober is available if the product is configured to add os-prober package (as optional or
    # mandatory).
    #
    # @todo This solution for os-prober is not perfect. Note that adding os-prober to the list of
    # optional packages implies that the package will be always installed if it is available in the
    # repositories, even if yast-bootloader does not need it (e.g., the selected bootloader is
    # grub2-bls). This is the less agressive solution for the SLE 16.1 RC phase. A more robust
    # solution will be implemented for 16.2, for example, with a dedicate option in the product
    # config.
    #
    # @param name [String]
    # @return [Boolean]
    def Available(name)
      log.info "Calling mocked module #{__FILE__}"

      # For os-prober, let's consider the package as available only if the product requires it.
      return require_os_prober? if name == OS_PROBER

      # For any other package, assume the package is available.
      true
    end

    # Sets the storage manager.
    #
    # @param storage [Agama::Storage::Manager]
    def storage=(storage)
      @storage = storage
    end

  private

    OS_PROBER = "os-prober"
    private_constant :OS_PROBER

    # Whether the product requires "os-prober" package.
    #
    # @return [Boolean]
    def require_os_prober?
      mandatory_packages = @storage&.product_config&.mandatory_packages || []
      optional_packages = @storage&.product_config&.optional_packages || []
      packages = mandatory_packages + optional_packages
      packages.include?(OS_PROBER)
    end
  end

  Package = PackageClass.new
  Package.main
end
