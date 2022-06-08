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
require "dinstaller_cli/commands/root_user"
require "dinstaller_cli/clients/users"

describe DInstallerCli::Commands::RootUser do
  subject { described_class.new }

  before do
    allow(subject).to receive(:puts)
    allow(DInstallerCli::Clients::Users).to receive(:new).and_return(client)
  end

  let(:client) { instance_double(DInstallerCli::Clients::Users) }

  describe "#ssh_key" do
    before do
      allow(client).to receive(:root_ssh_key).and_return("xyz-123")
    end

    context "when no SSH key is given" do
      it "shows the current SSH key" do
        expect(subject).to receive(:puts).with("xyz-123")

        subject.ssh_key
      end
    end

    context "when a SSH key is given" do
      it "selects the given SSH key" do
        expect(client).to receive(:root_ssh_key=).with("abc-789")

        subject.ssh_key("abc-789")
      end
    end
  end

  describe "#password" do
    before do
      allow(client).to receive(:root_password?).and_return(password_set)
    end

    context "when no password is given" do
      context "and the password is not set yet" do
        let(:password_set) { false }

        it "shows nothing" do
          expect(subject).to_not receive(:puts)

          subject.password
        end
      end

      context "and the password is set" do
        let(:password_set) { true }

        it "shows <secret>" do
          expect(subject).to receive(:puts).with("<secret>")

          subject.password
        end
      end
    end

    context "when a password is given" do
      let(:password_set) { true }

      it "sets the given password" do
        expect(client).to receive(:root_password=).with("n0ts3cr3t")

        subject.password("n0ts3cr3t")
      end
    end
  end

  describe "#clear" do
    it "removes root configuration" do
      expect(client).to receive(:remove_root_info)

      subject.clear
    end
  end
end
