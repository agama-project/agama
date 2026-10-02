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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"
require "y2storage"
require "cheetah"

describe Y2Storage::EncryptionProcesses::Sdboot do
  include_context "yast2-storage-ng test setup"

  let(:method) { Y2Storage::EncryptionMethod::TPM_BLS }
  let(:manager) { Y2Storage::StorageManager.instance }

  subject { described_class.new(method) }

  before { fake_scenario("mixed_disks") }

  describe "#encryption_type" do
    it "returns LUKS2" do
      expect(subject.encryption_type).to eq(Y2Storage::EncryptionType::LUKS2)
    end
  end

  describe "#create_device" do
    let(:blk_device) { manager.staging.find_by_name("/dev/sda2") }
    let(:dm_name) { "cr_test" }

    it "creates an encryption device with LUKS2 type" do
      encryption = subject.create_device(blk_device, dm_name)
      expect(encryption.type.is?(:luks2)).to eq(true)
    end

    context "when label is provided" do
      let(:label) { "test_label" }

      it "sets the label on the encryption device" do
        encryption = subject.create_device(blk_device, dm_name, label: label)
        expect(encryption.label).to eq(label)
      end
    end

    context "when label is nil" do
      it "does not set the label" do
        encryption = subject.create_device(blk_device, dm_name, label: nil)
        expect(encryption.label).to eq("")
      end
    end

    context "when pbkdf is provided" do
      let(:pbkdf) { Y2Storage::PbkdFunction::PBKDF2 }

      it "sets the pbkdf on the encryption device" do
        encryption = subject.create_device(blk_device, dm_name, pbkdf: pbkdf)
        expect(encryption.pbkdf).to eq(pbkdf)
      end
    end

    context "when pbkdf is nil" do
      it "does not set the pbkdf" do
        encryption = subject.create_device(blk_device, dm_name, pbkdf: nil)
        expect(encryption.pbkdf).to be_nil
      end
    end
  end

  describe "#finish_installation" do
    let(:blk_device) { manager.staging.find_by_name("/dev/sda2") }
    let(:dm_name) { "cr_test" }
    let(:password) { "test_password" }
    let(:device) do
      subject.create_device(blk_device, dm_name).tap do |enc|
        enc.password = password
      end
    end

    before do
      allow(Yast::Execute).to receive(:on_target!)
    end

    context "when password is not empty" do
      it "exports password for cryptenroll" do
        expect(Yast::Execute).to receive(:on_target!)
          .with(
            "keyctl", "padd", "user", "cryptenroll", "@s",
            hash_including(stdin: password)
          )

        subject.finish_installation(device)
      end

      it "exports password for sdbootutil" do
        expect(Yast::Execute).to receive(:on_target!)
          .with(
            "keyctl", "padd", "user", "sdbootutil", "@s",
            hash_including(stdin: password)
          )

        subject.finish_installation(device)
      end

      it "enrolls TPM2 authentication" do
        expect(Yast::Execute).to receive(:on_target!)
          .with(
            "/usr/bin/sdbootutil",
            "enroll",
            "--method=tpm2",
            "--devices=/dev/sda2"
          )

        subject.finish_installation(device)
      end
    end

    context "when password is empty" do
      let(:password) { "" }

      it "still attempts to enroll authentication" do
        expect(Yast::Execute).to receive(:on_target!)
          .with("/usr/bin/sdbootutil", "enroll", "--method=tpm2", "--devices=/dev/sda2")

        subject.finish_installation(device)
      end
    end

    context "when keyctl command fails" do
      before do
        allow(Yast::Execute).to receive(:on_target!)
          .with("keyctl", any_args)
          .and_raise(Cheetah::ExecutionFailed.new(["keyctl"], 1, "", "keyctl error"))
      end

      it "still attempts to enroll authentication" do
        expect(Yast::Execute).to receive(:on_target!)
          .with("/usr/bin/sdbootutil", any_args)

        subject.finish_installation(device)
      end
    end

    context "when sdbootutil enrollment fails" do
      before do
        allow(Yast::Execute).to receive(:on_target!)
          .with("/usr/bin/sdbootutil", any_args)
          .and_raise(Cheetah::ExecutionFailed.new(["/usr/bin/sdbootutil"], 1, "",
            "enrollment error"))
        allow(subject).to receive(:log).and_return(logger)
      end

      let(:logger) { double(error: nil) }

      it "logs the error" do
        expect(logger).to receive(:error).with(/Cannot enroll/)
        expect { subject.finish_installation(device) }.not_to raise_error
      end
    end
  end
end
