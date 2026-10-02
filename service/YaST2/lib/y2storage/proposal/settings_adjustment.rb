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

module Y2Storage
  module Proposal
    # Class to represent the different adjustments in the default proposal
    # settings performed by each attempt during {GuidedProposal.initial}, so
    # that information can be kept and displayed to the user.
    #
    # @note Although the name of the class and methods are designed to support
    #   more scenarios in the future, the current implementation only supports
    #   disabling attributes in concrete volumes, since that's the only action
    #   that {GuidedProposal.initial} performs so far.
    class SettingsAdjustment
      include Yast::I18n
      include Yast::Logger

      def initialize
        textdomain "storage"
        @volumes = {}
      end

      # New adjustment object created by registering a new modification to the
      # settings of a concrete volume
      #
      # @param volume [VolumeSpecification] concrete volume that was configured
      # @param attribute [Symbol] attribute of the volume that was adjusted
      # @param value [Object] value set for the attribute. Note that in the
      #   current implementation this is ignored and only false is accepted
      #   (see note in the class description).
      #
      # @return [SettingsAdjustment]
      def add_volume_attr(volume, attribute, value)
        raise ArgumentError, "So far, only disabling some attributes is supported" if value != false

        log.debug "Adjustments: add volume #{volume.mount_point} with #{attribute} == #{value}"
        result = dup
        result.volumes[volume.mount_point] ||= []
        result.volumes[volume.mount_point] << attribute
        log.debug "New adjustments: #{result.volumes}"
        result
      end

      # User-oriented localized sentences explaining each aspect of the
      # adjustment that have been performed on top of the default settings
      #
      # @return [Array<String>]
      def descriptions
        volumes.sort.map { |mp, attrs| volume_description(mp, attrs) }
      end

      # Whether the default settings were used (i.e. no adjustment was needed)
      #
      # @return [Boolean]
      def empty?
        volumes.empty?
      end

      protected

      # @return [Hash{String => Array<Symbol>}] list of attributes that have
      # been disabled for each volume (indexed by the mount path of the
      # volumes)
      attr_accessor :volumes

      # Localized sentence explaining what has been adapted for a concrete
      # volume
      #
      # @param mount_point [String] mount path of the volume
      # @param attrs [Array<Symbol>] list of attributes that have been disabled
      #   for the volume
      def volume_description(mount_point, attrs)
        (mount_point == "swap") ? swap_description(attrs) : regular_vol_description(mount_point, attrs)
      end

      # @see #volume_description
      def regular_vol_description(mount_point, attrs)
        if attrs.include?(:proposed)
          # TRANSLATORS: %s is a mount point like "/home"
          _("do not propose a separate %s") % mount_point
        elsif attrs.sort == [:adjust_by_ram, :snapshots]
          # TRANSLATORS: %s is a mount point like "/home"
          _("disable snapshots and RAM-based size adjustments for %s") % mount_point
        elsif attrs == [:snapshots]
          # TRANSLATORS: %s is a mount point like "/home"
          _("do not enable snapshots for %s") % mount_point
        elsif attrs == [:adjust_by_ram]
          # TRANSLATORS: %s is a mount point like "/home"
          _("do not adjust size of %s based on RAM size") % mount_point
        else
          raise "Unknown volume adjustment: #{attrs.inspect}"
        end
      end

      # @see #volume_description
      def swap_description(attrs)
        if attrs.include?(:proposed)
          _("do not propose swap")
        elsif attrs == [:adjust_by_ram]
          _("do not enlarge swap to RAM size")
        else
          raise "Unknown adjustment for swap: #{attrs.inspect}"
        end
      end

      # Clones this object
      def dup
        result = self.class.new
        result.volumes = Yast.deep_copy(volumes)
        result
      end
    end
  end
end
