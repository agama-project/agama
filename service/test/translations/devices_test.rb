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

# Translated strings of the vendored YaST code (textdomain "storage") that reach the D-Bus output
# through the encryption method labels and through the resize information of the devices.
#
# * Encryption methods: Y2Storage::EncryptionMethod::Base#to_human_string is used by the Agama
#   config checkers to build issue descriptions, which are serialized by
#   Agama::DBus::WithIssues#serialize_issues (the "Issues" property of the storage D-Bus object).
# * Resize reasons: Y2Storage::ResizeInfo#reason_text is used by Agama::Storage::DeviceShrinking,
#   which ends in the "shrinking.reasons" property of the device JSON (the devices of the "System"
#   and "Proposal" properties).
#
# The tests only check the English (untranslated) text, no locale is switched.

require_relative "../test_helper"
require_relative "../agama/storage/storage_helpers"
require "agama/config"
require "agama/dbus/with_issues"
require "agama/storage/devicegraph_conversions/to_json"
require "agama/storage/manager"
require "y2storage"
require "y2storage/bootloader_type"
require "yaml"

Yast::ProductFeatures.InitFeatures(true)

describe "Translated strings of encryption methods and resize reasons" do
  include Agama::RSpec::StorageHelpers

  describe "encryption method labels in the config issues" do
    let(:logger) { Logger.new($stdout, level: :fatal) }

    let(:product_config) do
      Agama::Config.new(YAML.load_file(File.join(FIXTURES_PATH, "storage.yaml")))
    end

    let(:manager) do
      Agama::Storage::Manager.new(logger: logger).tap do |manager|
        manager.update_product_config(product_config)
      end
    end

    # Object providing the same serialization used by the D-Bus storage object (see
    # Agama::DBus::Storage::Manager#serialize_issues).
    let(:serializer) do
      Class.new do
        include Agama::DBus::WithIssues

        public :serialize_issues
      end.new
    end

    let(:filesystem) { { path: "/" } }

    let(:bootloader_type) { nil }

    let(:config_json) do
      drive = { search: "/dev/sda", encryption: encryption, filesystem: filesystem }
      { storage: { drives: [drive] } }
    end

    # Descriptions of the issues as they are sent by D-Bus.
    def issue_descriptions
      manager.bootloader_config.type = bootloader_type if bootloader_type
      manager.configure(config_json)
      JSON.parse(serializer.serialize_issues(manager.issues)).map { |i| i["description"] }
    end

    before do
      mock_storage(devicegraph: "windows-linux-pc.yml")

      # Make the availability of the methods independent of the system running the tests.
      allow_any_instance_of(Y2Storage::EncryptionMethod::TpmFde)
        .to(receive(:possible?)).and_return(true)
      allow_any_instance_of(Y2Storage::EncryptionMethod::TpmBls)
        .to(receive(:possible?)).and_return(true)
      allow_any_instance_of(Y2Storage::EncryptionMethod::PervasiveLuks2)
        .to(receive(:available?)).and_return(true)
      allow_any_instance_of(Y2Storage::EncryptionMethod::Swap)
        .to(receive(:available?)).and_return(true)
    end

    context "with LUKS1 and no password" do
      let(:encryption) { { luks1: {} } }

      it "returns 'Regular LUKS1' (textdomain storage, encryption_method/luks1.rb:30)" do
        expect(issue_descriptions).to include(
          "No passphrase provided (required for using the method 'Regular LUKS1')."
        )
      end
    end

    context "with LUKS2 and no password" do
      let(:encryption) { { luks2: {} } }

      it "returns 'Regular LUKS2' (textdomain storage, encryption_method/luks2.rb:36)" do
        expect(issue_descriptions).to include(
          "No passphrase provided (required for using the method 'Regular LUKS2')."
        )
      end
    end

    context "with pervasive LUKS2 not available in the system" do
      let(:encryption) { { pervasiveLuks2: { password: "12345" } } }

      before do
        allow_any_instance_of(Y2Storage::EncryptionMethod::PervasiveLuks2)
          .to(receive(:available?)).and_return(false)
      end

      it "returns 'Pervasive Volume Encryption' (textdomain storage, " \
         "encryption_method/pervasive_luks2.rb:43)" do
        expect(issue_descriptions).to include(
          "Pervasive Volume Encryption is not available in this system."
        )
      end
    end

    context "with TPM FDE not possible in the system" do
      let(:encryption) { { tpmFde: { password: "12345" } } }

      before do
        allow_any_instance_of(Y2Storage::EncryptionMethod::TpmFde)
          .to(receive(:possible?)).and_return(false)
      end

      it "returns 'TPM-Based Full Disk Encrytion' (textdomain storage, " \
         "encryption_method/tpm_fde.rb:44)" do
        expect(issue_descriptions).to include(
          "TPM-Based Full Disk Encrytion is not available in this system."
        )
      end
    end

    context "with TPM BLS not possible in the system" do
      let(:encryption) { { luks2: { password: "12345", tpm: true } } }

      let(:bootloader_type) { Y2Storage::BootloaderType::SYSTEMD_BOOT }

      before do
        allow_any_instance_of(Y2Storage::EncryptionMethod::TpmBls)
          .to(receive(:possible?)).and_return(false)
      end

      it "returns 'BLS Compliant Encryption With TPM Unlocking' (textdomain storage, " \
         "encryption_method/tpm_bls.rb:38)" do
        expect(issue_descriptions).to include(
          "BLS Compliant Encryption With TPM Unlocking is not available in this system."
        )
      end
    end

    context "with a swap encryption used for a device different to swap" do
      {
        "random_swap"    => "Encryption with Volatile Random Key",
        "protected_swap" => "Encryption with Volatile Protected Key",
        "secure_swap"    => "Encryption with Volatile Secure Key"
      }.each do |json_value, label|
        context "and the method is #{json_value}" do
          let(:encryption) { json_value }

          it "returns '#{label}' (textdomain storage, encryption_method/#{json_value}.rb)" do
            expect(issue_descriptions).to include(
              "#{label} is not suitable for a device different to swap."
            )
          end
        end
      end
    end
  end

  describe "resize reasons in the shrinking info of the devices" do
    # Reasons that DeviceShrinking asks to ResizeInfo#reason_text (SHRINKING_REASONS and
    # RESIZE_REASONS in lib/agama/storage/device_shrinking.rb)
    reasons = [
      [:RB_RESIZE_NOT_SUPPORTED_BY_DEVICE, "Resizing is not supported by this device."],
      [:RB_MIN_MAX_ERROR,
       "Combined limitations of partition and filesystem prevent resizing."],
      [:RB_SHRINK_NOT_SUPPORTED_BY_FILESYSTEM, "This filesystem does not support shrinking."],
      [:RB_SHRINK_NOT_SUPPORTED_BY_MULTIDEVICE_FILESYSTEM,
       "This multi-device filesystem does not support shrinking."],
      [:RB_FILESYSTEM_INCONSISTENT, "Filesystem consistency check failed."],
      [:RB_MIN_SIZE_FOR_FILESYSTEM, "This filesystem already has the minimum possible size."],
      [:RB_FILESYSTEM_FULL, "The filesystem is full."],
      [:RB_MIN_SIZE_FOR_PARTITION, "This partition already has the minimum possible size."],
      [:RB_EXTENDED_PARTITION, "Extended partitions cannot be resized."],
      [:RB_ON_IMPLICIT_PARTITION_TABLE,
       "The partition on an implicit partition table cannot be resized."],
      [:RB_SHRINK_NOT_SUPPORTED_FOR_LVM_LV_TYPE,
       "Shrinking of this type of LVM logical volumes is not supported."],
      [:RB_RESIZE_NOT_SUPPORTED_FOR_LVM_LV_TYPE,
       "Resizing of this type of LVM logical volumes is not supported."],
      [:RB_RESIZE_NOT_SUPPORTED_DUE_TO_SNAPSHOTS,
       "Resizing not supported since the logical volume has snapshots."],
      [:RB_MIN_SIZE_FOR_LVM_LV, "The LVM logical volume already has the minimum possible size."],
      [:RB_PASSWORD_REQUIRED, "The encryption password is required."]
    ]

    before do
      # Disks with a partition and no file system (probing file systems makes the conversion slow).
      mock_storage(devicegraph: "yast2/y2storage/devicegraphs/alignment.yml")
    end

    def partition_json(reason)
      # libstorage-ng would try to inspect the (fake) filesystem. Use the same result that it would
      # return with the given blocker (see Y2Storage::Device#detect_resize_info).
      info = Y2Storage::ResizeInfo.new(Storage::ResizeInfo.new(false, Storage.const_get(reason)))
      allow_any_instance_of(Y2Storage::Device).to receive(:detect_resize_info).and_return(info)

      graph = Y2Storage::StorageManager.instance.probed
      json = Agama::Storage::DevicegraphConversions::ToJSON.new(graph).convert
      json.flat_map { |d| d[:partitions] || [] }.first
    end

    reasons.each do |reason, text|
      it "returns '#{text}' for #{reason} (textdomain storage, resize_info.rb)" do
        shrinking = partition_json(reason)[:block][:shrinking]

        expect(shrinking).to eq(supported: false, reasons: [text])
      end
    end
  end
end
