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
require "dinstaller/dbus/interfaces/service_status"
require "dinstaller/dbus/users"
require "dinstaller/users"

describe DInstaller::DBus::Users do
  subject { described_class.new(backend, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:backend) { instance_double(DInstaller::Users) }

  before do
    allow_any_instance_of(described_class).to receive(:register_service_status_callbacks)
  end

  it "defines ServiceStatus D-Bus interface" do
    expect(subject.intfs.keys).to include(
      DInstaller::DBus::Interfaces::ServiceStatus::SERVICE_STATUS_INTERFACE
    )
  end

  it "defines Validation D-Bus interface" do
    expect(subject.intfs.keys).to include(
      DInstaller::DBus::Interfaces::Validation::VALIDATION_INTERFACE
    )
  end

  describe ".new" do
    it "configures callbacks from ServiceStatus interface" do
      expect_any_instance_of(described_class).to receive(:register_service_status_callbacks)
      subject
    end
  end

  describe "first_user" do
    before do
      allow(backend).to receive(:first_user).and_return(user)
    end

    context "if there is no user yet" do
      let(:user) { nil }

      it "returns default data" do
        expect(subject.first_user).to eq(["", "", "", false, {}])
      end
    end

    context "if there is an user" do
      let(:user) do
        instance_double(Y2Users::User,
          full_name:        "Test user",
          name:             "test",
          password_content: "12345")
      end

      before do
        allow(backend).to receive(:autologin?).with(user).and_return(true)
      end

      it "returns the first user data" do
        expect(subject.first_user).to eq(["Test user", "test", "12345", true, {}])
      end
    end
  end
end
