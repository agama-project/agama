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
require "dinstaller/dbus/with_service_status"

class WithServiceStatusTest
  include DInstaller::DBus::WithServiceStatus
end

describe WithServiceStatusTest do
  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#service_status" do
    it "returns a service status" do
      expect(subject.service_status).to be_a(DInstaller::DBus::ServiceStatus)
    end
  end

  describe "#busy_while" do
    it "runs the given block, setting the service status as busy meanwhile" do
      expect(subject.service_status).to receive(:busy)
      expect(logger).to receive(:info).with(/running block/)
      expect(subject.service_status).to receive(:idle)

      subject.busy_while { logger.info("running block") }
    end

    it "returns the result of the block" do
      result = subject.busy_while { "test" }
      expect(result).to eq("test")
    end
  end
end
