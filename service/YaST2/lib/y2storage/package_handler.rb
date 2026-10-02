# Copyright (c) [2017,2020] SUSE LLC
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

Yast.import "Package"
Yast.import "PackagesProposal"
Yast.import "Mode"
Yast.import "Report"
Yast.import "Popup"
Yast.import "Label"

module Y2Storage
  #
  # Class that takes care of packages in the storage context: Add
  # storage-related packages to the set of packages to install during
  # installation, install small sets of packages in the installed system (for
  # the expert partitioner) as needed.
  #
  class PackageHandler
    include Yast::Logger
    include Yast::I18n

    # @return [Array<String>] list of packages to be installed (or marked for
    #   installation), it never includes duplicates or packages that are already
    #   installed
    attr_reader :pkg_list

    PROPOSAL_ID = "storage_proposal"

    # Constructor
    #
    # @param packages [Array<String>] packages to be added to {#pkg_list}
    # @param optional [Boolean] see {#optional}
    def initialize(packages, optional: false)
      textdomain("storage")
      @optional = optional
      @pkg_list = []
      add_packages(packages)
    end

    # Commit the changes depending on the current mode: During OS installation,
    # mark the package list for installation. In the installed system, install
    # them immediately.
    #
    def commit
      if installation?
        set_proposal_packages
      else
        install(ask: false)
      end
    end

    # Execute package installation. This will install the stored package list
    # immediately, so it is not advisable to do this during the OS
    # installation. In the latter case, use 'set_proposal_packages' instead.
    #
    # @param ask [Boolean] whether a dialog asking for confirmation should be
    #   shown to the user
    # @return true on success, false on error
    #
    def install(ask: true)
      return true if @pkg_list.empty?

      log.info("Installing #{pkg_list} (ask: #{ask}")
      success =
        if ask
          Yast::Package.CheckAndInstallPackages(@pkg_list)
        else
          Yast::Package.DoInstall(@pkg_list)
        end

      if !success
        log.error("ERROR: Some packages could not be installed")
        install_error_popup
      end
      success
    end

    # Set the proposal packages for storage. This marks the packages for
    # installation; it does not install them yet.
    #
    def set_proposal_packages
      return true if @pkg_list.empty?

      log.info("Marking #{pkg_list} for installation (optional: #{optional})")
      success = Yast::PackagesProposal.SetResolvables(
        PROPOSAL_ID, :package, @pkg_list, optional: optional
      )
      if !success
        log.error("PackagesProposal::SetResolvables() for #{pkg_list} failed")
        set_resolvables_error_popup
      end
      solve

      success
    end

    # Add the proposal packages for storage that are needed for the specified
    # devicegraph's used features. This marks the packages for installation;
    # it does not install them yet.
    #
    # @param devicegraph [Devicegraph] usually StorageManager.instance.staging
    # @param optional
    def self.set_proposal_packages_for(devicegraph, optional: true)
      required_packages = devicegraph.required_used_features.pkg_list
      PackageHandler.new(required_packages, optional: false).set_proposal_packages
      return unless optional

      optional_packages = devicegraph.optional_used_features.pkg_list
      PackageHandler.new(optional_packages, optional: true).set_proposal_packages
    end

    private

    # Whether the packages should be considered as optional when adding them to the
    # installation proposal.
    #
    # Obviously, this is relevant for {#set_proposal_packages} but not for {#install}.
    #
    # @return [Boolean]
    attr_reader :optional

    # Add a number of packages to the list of packages to be installed
    #
    # @param  pkg_list [Array<String>] package names
    # @return [Array<String>] new package list
    def add_packages(pkg_list)
      @pkg_list.concat(pkg_list)
      compact
    end

    # Remove duplicates from the package list and those packages that are
    # already installed.
    #
    # @return [Array<String>] compacted list
    #
    def compact
      @pkg_list.uniq!
      @pkg_list.reject! { |pkg| Yast::Package.Installed(pkg) } unless installation?
      @pkg_list
    end

    # Start a package dependency resolver run
    #
    def solve
      Yast::Pkg.PkgSolve(true)
    end

    # Post an error popup after installing some packages failed
    #
    def install_error_popup
      # This message is not very informative, but the Package module does
      # not provide any more information.
      #
      # TRANSLATORS: error popup
      Yast::Report.Error(_("Installing required packages failed."))
    end

    # Post an error popup after SetResolvables failed
    #
    def set_resolvables_error_popup
      pkg_list = @pkg_list.join(", ")
      # TRANSLATORS: error popup. %s is the list of affected packages.
      Yast::Report.Error(_("Adding the following packages failed: %s") % pkg_list)
    end

    # Whether the operating system is being installed
    #
    # If that's the case, we don't want to query and manage the packages in the
    # current system, but to prepare the proposal for the target one.
    #
    # @return [Boolean]
    def installation?
      Yast::Mode.installation
    end
  end
end
