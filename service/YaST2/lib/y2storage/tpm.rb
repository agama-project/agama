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

require "singleton"
require "yast"
require "yast2/execute"

module Y2Storage
  # Class to get information about TPM (Trusted Platform Module).
  class Tpm
    include Singleton
    include Yast

    # Whether a TPM2 is present.
    #
    # @return [Boolean]
    def version2?
      version == "2"
    end

    # Whether the TPM supports PolicyAuthorizeNV.
    #
    # @return [Boolean]
    def policy_authorize_nv?
      # systemd-pcrlock is using PolicyAuthorizeNV to store the policy inside
      # the TPM2's non volatile RAM. This feature is supported after TPM2 1.38
      # revision, and without it systemd-pcrlock will fail. These calls check
      # for version > 1.38 (bsc#1250403)
      return false unless version2?

      capabilities&.include?("TPM2_CC_PolicyAuthorizeNV") || false
    end

    private

    # TPM version.
    #
    # @return [String, nil] nil if the version is not detected.
    def version
      return @version if @version_checked

      @version_checked = true
      @version = read_version
    end

    # TPM capabilities.
    #
    # @return [String, nil] nil if the capabilities cannot be read.
    def capabilities
      return @capabilities if @capabilities_checked

      @capabilities_checked = true
      @capabilities = read_capabilities
    end

    # Reads the TPM version.
    #
    # @return [String, nil] nil if version cannot be read.
    def read_version
      Yast::SCR.Read(path(".target.string"), "/sys/class/tpm/tpm0/tpm_version_major")&.strip
    end

    # Reads the TPM capabilities
    #
    # @return [String, nil] nil if capabilities cannot be read.
    def read_capabilities
      Yast::Execute.locally!("tpm2_getcap", "commands", stdout: :capture)
    rescue Cheetah::ExecutionFailed
      nil
    end
  end
end
