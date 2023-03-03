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
require "dinstaller_cli/commands/user"
require "dinstaller/dbus/clients/users"

describe DInstallerCli::Commands::User do
  subject { described_class.new }

  before do
    allow(subject).to receive(:say)
    allow(DInstaller::DBus::Clients::Users).to receive(:new).and_return(client)
  end

  let(:create_result) { [true, []] }

  let(:client) do
    instance_double(DInstaller::DBus::Clients::Users, create_first_user: create_result)
  end

  describe "#set" do
    it "sets the first user config" do
      expect(client).to receive(:create_first_user).with("test", anything)
      expect(subject).to_not receive(:say)

      subject.set("test")
    end

    context "if there is some issue adding the first user" do
      let(:create_result) { [false, ["Error"]] }
      it "shows the errors" do
        expect(subject).to receive(:say).with("Error")

        subject.set("root")
      end
    end
  end

  describe "#show" do
    before do
      allow(client).to receive(:first_user).and_return(config)
    end

    context "when no user is configured" do
      let(:config) { [] }

      it "shows nothing" do
        expect(subject).to_not receive(:say)
      end
    end

    context "when a user is configured" do
      let(:config) { ["Test user", "test", "12345", true] }

      it "shows the first user config" do
        expect(subject).to receive(:say).once
          .with(/Full Name: Test user\nName: test\nAutologin: yes/)

        subject.show
      end
    end
  end

  describe "#clear" do
    it "removes the first user config" do
      expect(client).to receive(:remove_first_user)

      subject.clear
    end
  end
end
