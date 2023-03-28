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
require "agama/dbus/service_status"

describe Agama::DBus::ServiceStatus do
  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#new" do
    it "creates a service status as idle" do
      expect(subject.busy?).to eq(false)
    end
  end

  describe "#busy?" do
    context "if the service status is set to idle" do
      before do
        subject.idle
      end

      it "returns false" do
        expect(subject.busy?).to eq(false)
      end
    end

    context "if the service status is set to busy" do
      before do
        subject.busy
      end

      it "returns true" do
        expect(subject.busy?).to eq(true)
      end
    end
  end

  describe "#busy" do
    before do
      subject.idle
      subject.on_change { logger.info("change status") }
    end

    it "sets the service status as busy" do
      subject.busy
      expect(subject.busy?).to eq(true)
    end

    it "runs the 'on_change' callbacks" do
      expect(logger).to receive(:info).with(/change status/)
      subject.busy
    end
  end

  describe "#idle" do
    before do
      subject.busy
      subject.on_change { logger.info("change status") }
    end

    it "sets the service status as idle" do
      subject.idle
      expect(subject.busy?).to eq(false)
    end

    it "runs the 'on_change' callbacks" do
      expect(logger).to receive(:info).with(/change status/)
      subject.idle
    end
  end
end
