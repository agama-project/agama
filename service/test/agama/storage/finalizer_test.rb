# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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
require "agama/helpers"
require "agama/config"
require "agama/storage/finalize"
require "yaml"

describe Agama::Storage::Finalizer do
  include Agama::RSpec::StorageHelpers

  subject(:finalizer) { described_class.new(logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:copy_logs) { Agama::Storage::Finalizer::CopyLogsStep.new(logger) }
  let(:unmount) { Agama::Storage::Finalizer::UnmountStep.new(logger) }

  describe "#run" do
    before do
      allow_any_instance_of(described_class::Step).to receive(:run?).and_return(false)
      allow(described_class::Step).to receive(:run?).and_return(false)
      allow(copy_logs.class).to receive(:new).and_return(copy_logs)
      allow(copy_logs).to receive(:run?).and_return(true)
      allow(unmount.class).to receive(:new).and_return(unmount)
      allow(unmount).to receive(:run?).and_return(true)
    end

    it "runs the possible steps that must be run" do
      expect(copy_logs).to receive(:run)
      expect(unmount).to receive(:run)
      subject.run
    end
  end

  describe described_class::CopyLogsStep do
    let(:logger) { Logger.new($stdout, level: :warn) }
    let(:scripts_dir) { File.join(tmp_dir, "run", "agama", "scripts") }
    let(:tmp_dir) { Dir.mktmpdir }

    subject { described_class.new(logger) }

    before do
      allow(Yast::Installation).to receive(:destdir).and_return(File.join(tmp_dir, "mnt"))
      allow(Yast::Execute).to receive(:locally)
      stub_const("Agama::Storage::Finalizer::CopyLogsStep::SCRIPTS_DIR",
        File.join(tmp_dir, "run", "agama", "scripts"))
    end

    after do
      FileUtils.remove_entry(tmp_dir)
    end

    context "when scripts artifacts exist" do
      before do
        FileUtils.mkdir_p(scripts_dir)
        FileUtils.touch(File.join(scripts_dir, "test.sh"))
      end

      it "copies the artifacts to the installed system" do
        subject.run
        expect(File).to exist(File.join(tmp_dir, "mnt", "var", "log", "agama-installation",
          "scripts"))
      end
    end
  end

  describe described_class::UnmountStep do
    let(:logger) { Logger.new($stdout, level: :warn) }
    subject { described_class.new(logger) }

    it "unmounts the storage devices" do
      expect(Yast::WFM).to receive(:CallFunction).with("umount_finish", ["Write"])
      subject.run
    end
  end
end
