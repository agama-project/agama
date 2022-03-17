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
require "dinstaller/dbus/storage/actions"
require "dinstaller/storage/actions"
require "y2storage/compound_action"

describe DInstaller::DBus::Storage::Actions do
  subject { described_class.new(backend, logger) }

  let(:backend) do
    instance_double(DInstaller::Storage::Actions, all: actions)
  end

  let(:logger) { Logger.new($stdout) }

  let(:actions) do
    [
      instance_double(
        Y2Storage::CompoundAction,
        sentence:   "Delete action",
        device_is?: false,
        delete?:    true
      ),
      instance_double(
        Y2Storage::CompoundAction,
        sentence:   "File system action",
        device_is?: false,
        delete?:    false
      ),
      instance_double(
        Y2Storage::CompoundAction,
        sentence:   "Subvolume action",
        device_is?: true,
        delete?:    false
      )
    ]
  end

  describe "#all" do
    it "returns the list of actions" do
      expect(subject.all).to contain_exactly(
        { "Text" => "Delete action", "Subvol" => false, "Delete" => true },
        { "Text" => "File system action", "Subvol" => false, "Delete" => false },
        { "Text" => "Subvolume action", "Subvol" => true, "Delete" => false }
      )
    end
  end
end
