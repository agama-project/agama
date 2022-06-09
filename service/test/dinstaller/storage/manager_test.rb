# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "dinstaller/storage/manager"
require "dinstaller/progress"
require "dinstaller/questions_manager"
require "dinstaller/config"

describe DInstaller::Storage::Manager do
  subject(:storage) { described_class.new(logger, config) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:config) { DInstaller::Config.new }
  let(:progress) { DInstaller::Progress.new }

  describe "#probe" do
    let(:y2storage_manager) { instance_double(Y2Storage::StorageManager, probe: nil) }
    let(:proposal) { instance_double(DInstaller::Storage::Proposal, calculate: nil) }
    let(:actions) { instance_double(DInstaller::Storage::Actions) }
    let(:questions_manager) { instance_double(DInstaller::QuestionsManager) }

    before do
      allow(DInstaller::Storage::Proposal).to receive(:new).and_return(proposal)
      allow(DInstaller::Storage::Actions).to receive(:new).and_return(actions)
      allow(Y2Storage::StorageManager).to receive(:instance).and_return(y2storage_manager)
    end

    it "probes the storage devices and calculates a proposal" do
      expect(y2storage_manager).to receive(:activate) do |callbacks|
        expect(callbacks).to be_a(DInstaller::Storage::Callbacks::Activate)
      end
      expect(y2storage_manager).to receive(:probe)
      expect(proposal).to receive(:calculate)
      storage.probe(progress, questions_manager)
    end
  end

  describe "#install" do
    it "runs the inst_prepdisk client" do
      expect(Yast::WFM).to receive(:CallFunction).with("inst_prepdisk", [])
      storage.install(progress)
    end
  end

  describe "#actions" do
    it "returns an instance of the Storage::Actions class" do
      expect(storage.actions).to be_a(DInstaller::Storage::Actions)
    end
  end

  describe "#proposal" do
    it "returns an instance of the Storage::Proposal class" do
      expect(storage.proposal).to be_a(DInstaller::Storage::Proposal)
    end
  end
end
