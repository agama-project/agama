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
require "dinstaller/status_manager"

describe DInstaller::StatusManager do
  subject { described_class.new(initial_status) }

  let(:initial_status) { DInstaller::Status::Error.new }

  describe "#error?" do
    context "if the current status is error" do
      it "returns true" do
        expect(subject.error?).to eq(true)
      end
    end

    context "if the current status is not error" do
      let(:initial_status) { DInstaller::Status::Probed.new }

      it "returns false" do
        expect(subject.error?).to eq(false)
      end
    end
  end

  describe "#change" do
    before do
      subject.on_change { logger.info("change status") }
    end

    let(:logger) { Logger.new($stdout, level: :warn) }

    let(:new_status) { DInstaller::Status::Installed.new }

    it "sets the given status" do
      subject.change(new_status)

      expect(subject.status).to eq(new_status)
    end

    it "runs the callbacks" do
      expect(logger).to receive(:info).with(/change status/)

      subject.change(new_status)
    end
  end
end

describe DInstaller::Status do
  describe ".create" do
    it "creates a status according to the given id" do
      expect(DInstaller::Status.create(0)).to eq(DInstaller::Status::Error.new)
      expect(DInstaller::Status.create(1)).to eq(DInstaller::Status::Probing.new)
      expect(DInstaller::Status.create(2)).to eq(DInstaller::Status::Probed.new)
      expect(DInstaller::Status.create(3)).to eq(DInstaller::Status::Installing.new)
      expect(DInstaller::Status.create(4)).to eq(DInstaller::Status::Installed.new)
    end
  end
end
