# Copyright (c) [2017-2020] SUSE LLC
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

require "y2storage/storage_class_wrapper"
require "yast/i18n"

module Y2Storage
  # Information about the possibility of resizing a given device
  #
  # This class is not aimed to represent every possible set of conditions
  # or circumstances. As a result, although some devices (like LVM PVs on-disk)
  # can be shrunk with limitations (see pvresize), their ResizeInfo reports them
  # as if shrinking is not possible.
  #
  # This is a wrapper for Storage::ResizeInfo
  class ResizeInfo
    include StorageClassWrapper
    include Yast::I18n
    extend Yast::I18n
    wrap_class Storage::ResizeInfo

    # rubocop:disable Layout/LineLength
    REASON_TEXTS =
      {
        RB_RESIZE_NOT_SUPPORTED_BY_DEVICE:                 N_("Resizing is not supported by this device."),
        RB_MIN_MAX_ERROR:                                  N_("Combined limitations of partition and filesystem prevent resizing."),
        RB_SHRINK_NOT_SUPPORTED_BY_FILESYSTEM:             N_("This filesystem does not support shrinking."),
        RB_SHRINK_NOT_SUPPORTED_BY_MULTIDEVICE_FILESYSTEM: N_("This multi-device filesystem does not support shrinking."),
        RB_GROW_NOT_SUPPORTED_BY_FILESYSTEM:               N_("This filesystem does not support growing."),
        RB_FILESYSTEM_INCONSISTENT:                        N_("Filesystem consistency check failed."),
        RB_MIN_SIZE_FOR_FILESYSTEM:                        N_("This filesystem already has the minimum possible size."),
        RB_MAX_SIZE_FOR_FILESYSTEM:                        N_("This filesystem already has the maximum possible size."),
        RB_FILESYSTEM_FULL:                                N_("The filesystem is full."),
        RB_NO_SPACE_BEHIND_PARTITION:                      N_("There is no space behind this partition."),
        RB_MIN_SIZE_FOR_PARTITION:                         N_("This partition already has the minimum possible size."),
        RB_EXTENDED_PARTITION:                             N_("Extended partitions cannot be resized."),
        RB_ON_IMPLICIT_PARTITION_TABLE:                    N_("The partition on an implicit partition table cannot be resized."),
        RB_SHRINK_NOT_SUPPORTED_FOR_LVM_LV_TYPE:           N_("Shrinking of this type of LVM logical volumes is not supported."),
        RB_RESIZE_NOT_SUPPORTED_FOR_LVM_LV_TYPE:           N_("Resizing of this type of LVM logical volumes is not supported."),
        RB_RESIZE_NOT_SUPPORTED_DUE_TO_SNAPSHOTS:          N_("Resizing not supported since the logical volume has snapshots."),
        RB_NO_SPACE_IN_LVM_VG:                             N_("No space left in the LVM volume group."),
        RB_MIN_SIZE_FOR_LVM_LV:                            N_("The LVM logical volume already has the minimum possible size."),
        RB_MAX_SIZE_FOR_LVM_LV_THIN:                       N_("The LVM thin logical volume already has the maximum size."),
        RB_PASSWORD_REQUIRED:                              N_("The encryption password is required."),
        RB_FILESYSTEM_MOUNT_READ_ONLY:                     N_("Filesystem mounted in read-only mode.")
      }.freeze
    # rubocop:enable Layout/LineLength

    # @!method resize_ok?
    #   @return [Boolean] whether is possible to resize the device
    storage_forward :resize_ok?, to: :resize_ok

    # @!method min_size
    #   Minimal size the device can be resized to
    #
    #   Note this is not aligned.
    #
    #   @return [DiskSize]
    storage_forward :min_size, as: "DiskSize"

    # @!method max_size
    #   Maximum size the device can be resized to
    #
    #   Note this is not aligned.
    #
    #   @return [DiskSize]
    storage_forward :max_size, as: "DiskSize"

    # @!method reason_bits
    #   Reasons blocking a resize as OR'ed bits.
    #   In most cases, using 'reasons' will be more convenient.
    #
    #   @return [Integer]
    storage_forward :reason_bits, to: :reasons

    # Return the list of resizer blocker reasons known to libstorage.
    # This uses introspection to find all constants starting with RB_
    # in the ::Storage (libstorage) namespace.
    #
    # @return [Array<Symbol>] feature list
    #
    def libstorage_resize_blockers
      rb_reasons = ::Storage.constants.select { |c| c.to_s.start_with?("RB_") }
      # Sort by the constants' numeric value in ascending order
      rb_reasons.sort_by { |r| ::Storage.const_get(r) }
    end

    # One reason blocking a resize in (translated) text form.
    #
    # @return [String]
    #
    def reason_text(blocker_reason)
      textdomain "storage"
      text = REASON_TEXTS[blocker_reason]
      return _("Unknown reason") if text.nil?

      _(text)
    end

    # Reasons blocking a resize as an array of symbols such as
    # :RB_MIN_SIZE_FOR_FILESYSTEM etc.; see also FreeInfo.h in libstorage-ng.
    #
    # @return [Array<Symbol>]
    #
    def reasons
      libstorage_resize_blockers.each_with_object([]) do |rb, reasons|
        reasons << rb if reason?(rb)
      end
    end

    # Reasons blocking a resize in text form.
    #
    # @return [Array<String>]
    #
    def reason_texts
      reasons.map { |rb| reason_text(rb) }
    end

    # Return the bitmask for a resize blocker. This looks up a constant in the
    # ::Storage (libstorage) namespace with that name (one of the enum values
    # in ResizeInfo.h). If there is no constant with that name (i.e., the
    # feature is unknown to libstorage), this will throw a NameError.
    #
    # @param  blocker_reason [Symbol] RB_*
    # @return [Integer] bitmask for that feature
    #
    def bitmask(blocker_reason)
      ::Storage.const_get(blocker_reason)
    end

    # Check if one particular blocker reason is set in the current reasons.
    #
    # @return [Boolean]
    #
    def reason?(blocker_reason)
      mask = bitmask(blocker_reason)
      (reason_bits & mask) == mask
    end
  end
end
