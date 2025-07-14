# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "logger"
require "yast"
require "agama/cmdline_args"
require "agama/question"
require "agama/software/manager"
require "agama/software/callbacks/base"

Yast.import "Pkg"

module Agama
  module Software
    module Callbacks
      # Provide callbacks
      class PkgGpgCheck < Base
        # https://github.com/openSUSE/libzypp/blob/6b385649d18269fcba8d80ed356adb8100be920d/zypp/target/rpm/RpmDb.h#L378-L384
        CHK_OK         = 0 # Signature is OK
        CHK_NOTFOUND   = 1 # Signature is unknown type
        CHK_FAIL       = 2 # Signature does not verify
        CHK_NOTTRUSTED = 3 # Signature is OK, but key is not trusted
        CHK_NOKEY      = 4 # Public key is unavailable
        CHK_ERROR      = 5 # File does not exist or can't be opened
        CHK_NOSIG      = 6 # File has no gpg signature

        # Register the callbacks
        def setup
          Yast::Pkg.CallbackPkgGpgCheck(
            Yast::FunRef.new(method(:pkg_gpg_check), "string(map)")
          )
        end

        # Package GPG check callback
        #
        # @param data [Hash] callback data, see
        #  https://github.com/yast/yast-pkg-bindings/blob/853496f527543e6d51730fd7e3126ad94b13c303/src/Callbacks.cc#L739
        # @return [String] "I" for ignore, "R" for retry and "A" for abort,
        #   empty string ("") means no decision has been made
        # @see https://github.com/yast/yast-yast2/blob/19180445ab935a25edd4ae0243aa7a3bcd09c9de/library/packages/src/modules/PackageCallbacks.rb#L620
        def pkg_gpg_check(data)
          error_code = data["CheckPackageResult"]
          package = data["Package"]

          if error_code == CHK_OK
            logger.debug "GPG check succeeded for package #{package}"
            return ""
          end

          logger.warn "GPG check failed for package #{package}, error code: #{error_code}"

          # ignore the error when the package comes from the DUD repository and
          # the DUD package GPG checks are disabled via a boot option
          if data["RepoMediaUrl"] == Agama::Software::Manager.dud_repository_url &&
              ignore_dud_packages_gpg_errors?

            logger.info "Ignoring the GPG check failure for a DUD package"
            return "I"
          end

          # no decision made, the error will be reported by the DoneProvide callback again
          ""
        end

      private

        # Should be the DUD packages GPG signatures verified? The GPG errors can
        # be ignored by using the "inst.dud_packages.gpg=0" boot option
        #
        # @return [Boolean] `true` if the GPG errors should be ignored, `false` otherwise
        def ignore_dud_packages_gpg_errors?
          return @ignore_dud_packages_gpg_errors unless @ignore_dud_packages_gpg_errors.nil?

          cmdline_args = CmdlineArgs.read
          dud = cmdline_args.data["dud_packages"]
          gpg = dud && dud["gpg"]

          @ignore_dud_packages_gpg_errors = [false, "0"].include?(gpg)
        end
      end
    end
  end
end
