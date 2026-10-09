# Copyright (c) [2018-2021] SUSE LLC
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
require "y2storage/callbacks/issues_callback"
require "y2storage/storage_features_list"
require "y2storage/package_handler"

Yast.import "Mode"
Yast.import "Pkg"

module Y2Storage
  module Callbacks
    # Class to implement callbacks used during libstorage-ng probe
    class Probe < Storage::ProbeCallbacksV3
      include IssuesCallback

      include Yast::I18n

      include Yast::Logger

      # @param user_callbacks [UserProbe] Probing user callbacks
      def initialize(user_callbacks: nil)
        textdomain "storage"

        super()
        @user_callbacks = user_callbacks || YastProbe.new
      end

      # Callback for libstorage-ng to show a message to the user.
      #
      # Currently it performs no action, we don't want to bother the regular
      # user with information about every single step. Libstorage-ng is
      # already writing that information to the YaST logs.
      #
      # @param message [String] message text (in the ASCII-8BIT encoding!,
      #   see https://sourceforge.net/p/swig/feature-requests/89/,
      #   it is recommended to force it to the UTF-8 encoding before
      #   doing anything with the string to avoid the Encoding::CompatibilityError
      #   exception!)
      # See Storage::Callbacks#message in libstorage-ng
      def message(message); end

      # Callback for missing commands during probing.
      #
      # @param message [String] error title coming from libstorage-ng
      #   (in the ASCII-8BIT encoding! see https://sourceforge.net/p/swig/feature-requests/89/)
      # @param what [String] details coming from libstorage-ng (in the ASCII-8BIT encoding!)
      # @param command [String] missing command coming from libstorage-ng (in the ASCII-8BIT encoding!)
      # @param used_features [Integer] used features bit field as integer coming from libstorage-ng
      #
      # @return [Boolean] true will make libstorage-ng ignore the error, false
      #   will result in a libstorage-ng exception
      def missing_command(message, what, command, used_features)
        # force the UTF-8 encoding to avoid Encoding::CompatibilityError exception
        message.force_encoding("UTF-8")
        what.force_encoding("UTF-8")
        command.force_encoding("UTF-8")

        log.info "libstorage-ng reported a missing command, asking the user whether to continue"
        log.info "Error details. message: #{message}. what: #{what}. command: #{command}. "\
                 "used_features: #{used_features}."

        packages = StorageFeaturesList.from_bitfield(used_features).pkg_list

        # Redirect to error callback if no packages can be installed.
        return error(message, what) unless can_install?(packages)

        answer = user_callbacks.install_packages?(packages)
        log.info "User answer: #{answer} (packages #{packages})"

        # continue if the user does not want to install the missing packages
        return true unless answer

        # install the missing packages and try again
        PackageHandler.new(packages).commit
        @again = true
        false
      end

      # Initialization
      def begin
        # Release all sources before probing. Otherwise, unmount action could fail if the mount point
        # of the software source device is modified. Note that this is only necessary during the
        # installation because libstorage-ng would try to unmount from the chroot path
        # (e.g., /mnt/mount/point) and there is nothing mounted there.
        Yast::Pkg.SourceReleaseAll if Yast::Mode.installation

        @again = false
      end

      # Should probing be run again?
      #
      # @return [Boolean] Whether probing should be run again
      def again?
        @again
      end

      private

      # @return [UserProbe] Probing user callbacks
      attr_reader :user_callbacks

      def can_install?(packages)
        if packages.empty?
          log.info "No packages to install"
          return false
        end

        if !Yast::Mode.normal
          log.info "Packages can only be installed in normal mode"
          return false
        end

        true
      end
    end
  end
end
