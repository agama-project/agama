# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "yast/i18n"
require "y2storage"

module Agama
  module Storage
    # Generates information about shrinking a block device.
    class DeviceShrinking
      include Yast::I18n

      # @param device [Y2Storage::BlkDevice]
      def initialize(device)
        textdomain "agama"

        @device = device
      end

      # Whether the device can be shrunk.
      #
      # Conditions to allow shrinking:
      #   * Either the device does not exist in system yet or it has some content.
      #   * The device allows shriking to a minimum valid size (bigger than 0 and less than the
      #     device size).
      #   * There is no reason preventing to shrink the device.
      #
      # @return [Boolean]
      def supported?
        (!device.exists_in_probed? || content?) && min_size? && !reasons?
      end

      # Minimun size the device can be shrunk to.
      #
      # @return [DiskSize, nil] nil if the device cannot be shrunk.
      def min_size
        return nil unless supported?

        device.resize_info.min_size
      end

      # Reasons because the device cannot be shrunk.
      #
      # @return [Array<String>, nil] nil if the device can be shrunk.
      def unsupported_reasons
        return nil if supported?

        [
          content_reason_text,
          min_size_reason_text,
          shrinking_reasons_text,
          resize_reasons_text
        ].flatten.compact
      end

    private

      # @return [Y2Storage::BlkDevice]
      attr_reader :device

      # Reasons preventing shrinking.
      SHRINKING_REASONS = [
        :RB_SHRINK_NOT_SUPPORTED_BY_FILESYSTEM,
        :RB_SHRINK_NOT_SUPPORTED_BY_MULTIDEVICE_FILESYSTE,
        :RB_MIN_SIZE_FOR_FILESYSTEM,
        :RB_MIN_SIZE_FOR_PARTITION,
        :RB_SHRINK_NOT_SUPPORTED_FOR_LVM_LV_TYPE,
        :RB_MIN_SIZE_FOR_LVM_LV,
        :RB_FILESYSTEM_FULL
      ].freeze
      private_constant :SHRINKING_REASONS

      # Reasons preventing both shrinking and growing.
      RESIZE_REASONS = [
        :RB_RESIZE_NOT_SUPPORTED_BY_DEVICE,
        :RB_MIN_MAX_ERROR,
        :RB_FILESYSTEM_INCONSISTENT,
        :RB_EXTENDED_PARTITION,
        :RB_ON_IMPLICIT_PARTITION_TABLE,
        :RB_RESIZE_NOT_SUPPORTED_FOR_LVM_LV_TYPE,
        :RB_RESIZE_NOT_SUPPORTED_DUE_TO_SNAPSHOTS,
        :RB_PASSWORD_REQUIRED
      ].freeze
      private_constant :RESIZE_REASONS

      # Whether the device has some content.
      #
      # If the device only contains an encryption layer, then the device is considered as empty.
      #
      # @return [Boolean]
      def content?
        device = self.device.encryption || self.device
        device.descendants.any?
      end

      # Whether the device can be shrunk to a minimum valid size.
      #
      # @return [Boolean]
      def min_size?
        min_size = device.resize_info.min_size

        min_size > 0 && min_size != device.size
      end

      # Whether there is some reason preventing to shrink the device.
      #
      # @return [Boolean]
      def reasons?
        shrinking_reasons.any? || resize_reasons.any?
      end

      # Reasons preventing to shrink.
      #
      # @return [Array<Symbol>]
      def shrinking_reasons
        device.resize_info.reasons.select { |r| SHRINKING_REASONS.include?(r) }
      end

      # Reasons preventing both to shrink and to grow.
      #
      # @return [Array<Symbol>]
      def resize_reasons
        device.resize_info.reasons.select { |r| RESIZE_REASONS.include?(r) }
      end

      # Text of the reason preventing to shrink because there is no content.
      #
      # @return [String, nil] nil if there is content or there is any other reasons.
      def content_reason_text
        return nil if content? || reasons?

        _("Neither a file system nor a storage system was detected on the device. In case the " \
          "device does contain a file system or a storage system that is not supported, resizing " \
          "will most likely cause data loss.")
      end

      # Text of the reason preventing to shrink because there is no valid minimum size.
      #
      # @return [String, nil] nil if there is a minimum size or there is any other reasons.
      def min_size_reason_text
        return nil if min_size? || reasons?

        _("Shrinking is not supported by this device")
      end

      # Text of the reasons proventing to shrink.
      #
      # @return [Array<String>]
      def shrinking_reasons_text
        shrinking_reasons.map { |r| reason_text(r) }
      end

      # Text of the reasons proventing both to shrink and to grow.
      #
      # @return [Array<String>]
      def resize_reasons_text
        resize_reasons.map { |r| reason_text(r) }
      end

      # Text of the given reason.
      #
      # @param reason [Symbol]
      # @return [String]
      def reason_text(reason)
        device.resize_info.reason_text(reason)
      end
    end
  end
end
