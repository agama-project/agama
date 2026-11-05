# Copyright (c) [2018-2022] SUSE LLC
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
require "pathname"
require "y2storage/blk_device"
require "y2storage/setup_error"
require "y2storage/boot_requirements_checker"
require "y2storage/proposal_settings"
require "y2storage/with_security_policies"
require "y2storage/storage_manager"

# This 'import' is necessary to load the control file (/etc/YaST/control.xml)
# when running in an installed system. During installation, this module
# is imported by WorkflowManager.
Yast.import "ProductControl"
Yast.import "Mode"

module Y2Storage
  # Class to check whether a setup (devicegraph) fulfills the storage requirements
  #
  # The storage requirements are the set of necessary volumes to properly boot and
  # run the system. Boot checkings are actually performed by class BootRequirementsChecker,
  # and needed volumes to run the system are read from control file (control.xml).
  #
  # @example
  #   checker = SetupChecker.new(devicegraph)
  #   checker.valid? #=> true
  class SetupChecker
    include Yast::I18n
    include Yast::Logger
    include WithSecurityPolicies

    # @return [Devicegraph]
    attr_reader :devicegraph

    # Constructor
    #
    # @param devicegraph [Devicegraph] setup to check
    def initialize(devicegraph)
      textdomain "storage"
      @devicegraph = devicegraph
    end

    # Whether the current setup fulfills the storage requirements
    #
    # @return [Boolean]
    def valid?
      errors.empty? && warnings.empty?
    end

    # Whether the system contain fatal errors preventing to continue
    #
    # @return [Array<SetupError>]
    def errors
      boot_requirements_checker.errors
    end

    # All storage warnings detected in the setup, for example, when a /boot/efi partition
    # is missing in a UEFI system, or a required product volume (e.g., swap) is missing.
    #
    # @see SetupError
    #
    # @return [Array<SetupError>]
    def warnings
      boot_warnings + product_warnings + mount_warnings + security_policy_warnings + encryption_warnings
    end

    # All encryption warnings detected in the setup
    #
    # Argion2* needs at least 4GiB of memory. Otherwise cryptsetup could crash (bsc#1246876).
    #
    # @return [Array<SetupError>]
    def encryption_warnings
      return [] if DiskSize.new(StorageManager.instance.arch.ram_size) >= DiskSize.GiB(4)

      unless @encryption_warnings
        @encryption_warnings = []
        @devicegraph.encryptions
          .select(&:supports_pbkdf?)
          .each do |e|
          next unless ["argon2id", "argon2i"].include?(e.pbkdf.value)

          @encryption_warnings << SetupError.new(
            message: format(_("Using %s for %s but this needs 4 GiB RAM at least."),
              e.pbkdf.name, e.blk_device.name)
          )
        end
      end
      @encryption_warnings
    end

    # All boot errors detected in the setup
    #
    # @return [Array<SetupError>]
    #
    # @see BootRequirementsChecker#errors
    def boot_warnings
      @boot_warnings ||= boot_requirements_checker.warnings
    end

    # All product warnings detected in the setup
    #
    # This checks that all mandatory volumes specified in control file are present
    # in the system.
    #
    # @return [Array<SetupError>]
    def product_warnings
      @product_warnings ||= missing_product_volumes.map { |v| SetupError.new(missing_volume: v) }
    end

    # All warnings related to the definition of the mount points in the setup
    #
    # This checks for example whether the mount options make sense.
    #
    # @return [Array<SetupError>]
    def mount_warnings
      devicegraph.mount_points.map { |mp| mount_warning(mp) }.compact
    end

    # Security policy warnings detected in the setup
    #
    # @return [Array<SetupError>]
    def security_policy_warnings
      @security_policy_warnings ||= security_policy_failing_rules.map do |rule|
        SetupError.new(message: "#{rule.identifiers.first} #{rule.description}")
      end
    end

    # Currently enabled security policy
    #
    # @note yast2-security might not be available, see {#with_security_policies}.
    #
    # @return [Y2Security::SecurityPolicies::Policy, nil]
    def security_policy
      with_security_policies { Y2Security::SecurityPolicies::Manager.instance.enabled_policy }
    end

    # Failing rules from the enabled security policy
    #
    # @note yast2-security might not be available, see {#with_security_policies}.
    #
    # @return [Array<Y2Security::SecurityPolicies::Rule>]
    def security_policy_failing_rules
      return [] unless Yast::Mode.installation

      failing_rules = with_security_policies do
        policies_manager = Y2Security::SecurityPolicies::Manager.instance
        target_config = Y2Security::SecurityPolicies::TargetConfig.new.tap do |config|
          config.storage = devicegraph
        end

        policies_manager.failing_rules(target_config, scope: :storage)
      end

      failing_rules || []
    end

    private

    # Mandatory product volumes that are not present in the current setup
    #
    # @see #product_volumes
    #
    # @return [Array<VolumeSpecification>]
    def missing_product_volumes
      product_volumes.select { |v| missing?(v) }
    end

    # Mandatory product volumes for a valid storage setup
    #
    # @note This volumes are obtained from the control file (control.xml) and only
    #   mandatory volumes are taken into account.
    #
    # @see ProposalSettings#volumes
    #
    # @return [Array<VolumeSpecification>]
    def product_volumes
      # ProposalSettings#volumes is initialized to nil when using old settings format
      # because this attribute does not exist with old format
      volumes = proposal_settings.volumes || []
      volumes.select { |v| mandatory?(v) }
    end

    # Whether a volume is mandatory, that is, the volume is proposed to be created
    # and cannot be deactivated.
    #
    # @param volume [VolumeSpecification]
    # @return [Boolean] true if the volume is mandatory; false otherwise.
    def mandatory?(volume)
      volume.proposed? && !volume.proposed_configurable?
    end

    # Whether a volume is missing in the current setup
    #
    # @see BlkDevice#match_volume?
    #
    # @param volume [VolumeSpecification]
    # @return [Boolean] true if the volume is missing; false otherwise.
    def missing?(volume)
      # Users mounting system volumes as NFS are supposed to know what they are doing
      return false if nfs?(volume)

      BlkDevice.all(devicegraph).none? { |d| d.match_volume?(volume) }
    end

    # Whether a volume is present in the current setup as an NFS mount
    #
    # @param volume [VolumeSpecification]
    # @return [Boolean]
    def nfs?(volume)
      return false unless volume.mount_point

      devicegraph.nfs_mounts.any? do |nfs|
        nfs.mount_point&.path?(volume.mount_point)
      end
    end

    # @see #mount_warnings
    #
    # @param mount_point [MountPoint]
    # @return [SetupError, nil]
    def mount_warning(mount_point)
      missing = mount_point.missing_mount_options
      return if missing.empty?

      # TRANSLATORS: do not translate %{opt} or %{path}. %{opt} is replaced by the name of a mount
      # option in the singular sentence or a list of options separated by commas in the plural one.
      # ${path} is replaced by the mount point.
      msg = n_(
        format(
          "The fstab option %{opt} may be needed to properly mount %{path}.",
          opt: missing.first, path: mount_point.path
        ),
        format(
          "The following fstab options may be needed to propely mount %{path}: %{opt}",
          opt: missing.join(","), path: mount_point.path
        ),
        missing.size
      )
      SetupError.new(message: msg)
    end

    # @return [BootRequirementsChecker] shortcut for boot requirements checker
    # with given device graph
    def boot_requirements_checker
      @boot_requirements_checker ||= BootRequirementsChecker.new(
        devicegraph,
        bootloader: proposal_settings.bootloader
      )
    end

    # @return [ProposalSettings] shortcut for the default settings
    def proposal_settings
      @proposal_settings ||= ProposalSettings.new_for_current_product
    end
  end
end
