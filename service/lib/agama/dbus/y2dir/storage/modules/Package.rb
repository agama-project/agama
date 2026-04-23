# Copyright (c) [2022-2024] SUSE LLC
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
require "agama/dbus/clients/software"

# :nodoc:
module Yast
  # Replacement for the Yast::Package module.
  class PackageClass < Module
    def main
      puts "Loading mocked module #{__FILE__}"
      @client = Agama::DBus::Clients::Software.instance
    end

    # Determines whether a package is available.
    #
    # @param name [String] Package name.
    # @return [Boolean]
    def Available(name)
      client.package_available?(name)
    end

    # Determines whether a set of packages is available.
    #
    # @param names [Array<String>] Names of the packages.
    # @return [Boolean]
    def AvailableAll(names)
      names.all? { |name| client.package_available?(name) }
    end

    # Determines whether a package is installed in the target system.
    #
    # @param name [String] Package name.
    # @return [Boolean]
    def Installed(name, target: nil)
      client.package_installed?(name)
    end

  private

    attr_reader :client
  end

  Package = PackageClass.new
  Package.main
end
