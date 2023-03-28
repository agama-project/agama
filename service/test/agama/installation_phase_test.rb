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

require_relative "../test_helper"
require "agama/installation_phase"

describe DInstaller::InstallationPhase do
  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    subject.on_change { logger.info("change phase") }
  end

  describe "startup?" do
    context "if the installation phase is startup" do
      before do
        subject.startup
      end

      it "returns true" do
        expect(subject.startup?).to eq(true)
      end
    end

    context "if the installation phase is not startup" do
      before do
        subject.config
      end

      it "returns false" do
        expect(subject.startup?).to eq(false)
      end
    end
  end

  describe "config?" do
    context "if the installation phase is config" do
      before do
        subject.config
      end

      it "returns true" do
        expect(subject.config?).to eq(true)
      end
    end

    context "if the installation phase is not config" do
      before do
        subject.startup
      end

      it "returns false" do
        expect(subject.config?).to eq(false)
      end
    end
  end

  describe "install?" do
    context "if the installation phase is install" do
      before do
        subject.install
      end

      it "returns true" do
        expect(subject.install?).to eq(true)
      end
    end

    context "if the installation phase is not install" do
      before do
        subject.config
      end

      it "returns false" do
        expect(subject.install?).to eq(false)
      end
    end
  end

  describe "#startup" do
    it "sets the installation phase to startup" do
      subject.startup
      expect(subject.startup?).to eq(true)
    end

    it "runs the 'on_change' callbacks" do
      expect(logger).to receive(:info).with(/change phase/)
      subject.startup
    end
  end

  describe "#config" do
    it "sets the installation phase to config" do
      subject.config
      expect(subject.config?).to eq(true)
    end

    it "runs the 'on_change' callbacks" do
      expect(logger).to receive(:info).with(/change phase/)
      subject.config
    end
  end

  describe "#install" do
    it "sets the installation phase to install" do
      subject.install
      expect(subject.install?).to eq(true)
    end

    it "runs the 'on_change' callbacks" do
      expect(logger).to receive(:info).with(/change phase/)
      subject.install
    end
  end
end
