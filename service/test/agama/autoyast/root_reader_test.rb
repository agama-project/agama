# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "yast"
require "agama/autoyast/root_reader"

Yast.import "Profile"

describe Agama::AutoYaST::RootReader do
  let(:profile) do
    { "users" => [root, user] }
  end

  let(:user) do
    {
      "username"      => "suse",
      "fullname"      => "SUSE",
      "user_password" => "nots3cr3t",
      "encrypted"     => false
    }
  end

  let(:root) do
    { "username"        => "root",
      "user_password"   => "123456",
      "encrypted"       => false,
      "authorized_keys" => ["ssh-key 1", "ssh-key 2"] }
  end

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  describe "#read" do
    context "when there is no 'users' section" do
      let(:profile) { {} }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when no root user is defined" do
      let(:profile) { { "users" => [user] } }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when a root user is defined" do
      it "includes a 'root' key with the root user data" do
        root = subject.read["root"]
        expect(root).to eq(
          "password" => "123456", "sshPublicKey" => "ssh-key 1"
        )
      end
    end
  end
end
