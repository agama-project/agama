# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require_relative "../../test_helper"
require_relative "storage_helpers"
require_relative "../with_progress_examples"
require "agama/helpers"
require "agama/config"
require "agama/security"
require "agama/storage/finisher"

describe Agama::Storage::Finisher do
  include Agama::RSpec::StorageHelpers

  subject(:storage) { described_class.new(logger, config, security) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:config_path) do
    File.join(FIXTURES_PATH, "root_dir", "etc", "agama.yaml")
  end

  let(:destdir) { File.join(FIXTURES_PATH, "target_dir") }
  let(:config) { Agama::Config.from_file(config_path) }
  let(:security) { instance_double(Agama::Security, probe: nil, write: nil) }
  let(:copy_files) { Agama::Storage::Finisher::CopyFilesStep.new(logger) }
  let(:progress) { instance_double(Agama::Progress, step: nil) }

  describe "#run" do
    before do
      allow_any_instance_of(described_class::Step).to receive(:run?).and_return(false)
      allow(described_class::Step).to receive(:run?).and_return(false)
      allow(copy_files.class).to receive(:new).and_return(copy_files)
      allow(copy_files).to receive(:run?).and_return(true)
      allow(subject).to receive(:progress).and_return(progress)
    end

    it "runs the possible steps that must be run" do
      expect(subject).to receive(:start_progress_with_size).with(1)
      expect(subject.progress).to receive(:step) do |label, &block|
        expect(label).to eql(copy_files.label)
        expect(copy_files).to receive(:run)
        block.call
      end

      subject.run
    end
  end

  describe described_class::Step do
    subject { described_class.new(logger) }

    describe "#run?" do
      it "returns whether the step must be executed or not (default: true)" do
        expect(subject.run?).to eql(true)
      end
    end
  end

  describe described_class::CopyFilesStep do
    subject { copy_files }
    before do
      allow(Yast::Installation).to receive(:destdir).and_return(destdir)
      allow(subject).to receive(:root_dir).and_return(File.join(FIXTURES_PATH, "root_dir"))
    end

    around do |block|
      FileUtils.mkdir_p(destdir)
      block.call
      FileUtils.rm_rf(destdir)
    end

    describe "#run" do
      let(:rules) do
        [
          "41-cio-ignore.rules", "41-dasd-eckd-0.0.0160.rules",
          "41-qeth-0.0.0800.rules", "70-persistent-net.rules"
        ]
      end

      it "copies some specific udev rules to the target system when exist" do
        subject.run
        rules.each do |rule|
          expect(File.exist?(File.join(destdir, "/etc/udev/rules.d/#{rule}"))).to eql(true)
        end
      end
    end
  end

  describe described_class::BootloaderStep do
    subject { described_class.new(logger) }
    let(:on_s390) { false }

    before do
      allow(Yast::Arch).to receive(:s390).and_return(on_s390)
      allow_any_instance_of(::Bootloader::FinishClient).to receive(:write)
    end

    context "when running on s390x" do
      let(:on_s390) { true }

      describe "#run" do
        it "runs the cio_ignore_finish client" do
          expect(subject).to receive(:wfm_write).with("cio_ignore_finish")
          subject.run
        end
      end
    end

    context "when not running on s390x" do
      describe "#run" do
        it "does not run the cio_ignore_finish client" do
          expect(subject).to_not receive(:wfm_write).with("cio_ignore_finish")
          subject.run
        end
      end
    end

    it "runs the Bootloader Finish Client" do
      expect_any_instance_of(::Bootloader::FinishClient).to receive(:write)
      subject.run
    end
  end

  include_examples "progress"
end
