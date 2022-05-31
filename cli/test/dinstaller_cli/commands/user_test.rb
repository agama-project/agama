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
require "dinstaller_cli/clients/users"

describe DInstallerCli::Commands::User do
  subject { described_class.new }

  before do
    allow(subject).to receive(:puts)
    allow(DInstallerCli::Clients::Users).to receive(:new).and_return(client)
  end

  let(:client) { instance_double(DInstallerCli::Clients::Users) }

  describe "#set" do
    it "sets the first user config" do
      expect(client).to receive(:create_first_user).with("test", anything)

      subject.set("test")
    end
  end

  describe "#show" do
    before do
      allow(client).to receive(:first_user).and_return(config)
    end

    context "when no user is configured" do
      let(:config) { [] }

      it "shows nothing" do
        expect(subject).to_not receive(:puts)
      end
    end

    context "when a user is configured" do
      let(:config) { ["Test user", "test", true] }

      it "shows the first user config" do
        expect(subject).to receive(:puts).with(/Full Name: Test user/)
        expect(subject).to receive(:puts).with(/Name: test/)
        expect(subject).to receive(:puts).with(/Autologin: yes/)

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
