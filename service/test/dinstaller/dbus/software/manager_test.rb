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

require_relative "../../../test_helper"
require "dinstaller/dbus/software/manager"
require "dinstaller/software"
require "dinstaller/status_manager"
require "dinstaller/progress"

describe DInstaller::DBus::Software::Manager do
  subject { described_class.new(backend, logger) }

  let(:backend) do
    instance_double(DInstaller::Software, status_manager: status_manager, progress: progress)
  end

  let(:logger) { Logger.new($stdout) }

  let(:status_manager) { DInstaller::StatusManager.new(status) }

  let(:status) { DInstaller::Status::Installing.new }

  let(:progress) { DInstaller::Progress.new }

  it "configures callbacks for changes in the status" do
    new_status = DInstaller::Status::Installed.new

    expect(subject).to receive(:PropertiesChanged) do |iface, properties, _|
      expect(iface).to match(/Software1/)
      expect(properties["Status"]).to eq(new_status.id)
    end

    status_manager.change(new_status)
  end

  describe "#status" do
    it "returns the id of its current status" do
      expect(subject.status).to eq(status.id)
    end
  end
end
