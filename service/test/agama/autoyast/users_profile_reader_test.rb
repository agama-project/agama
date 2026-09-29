# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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
require "agama/autoyast/users_profile_reader"

Yast.import "Profile"

describe Agama::AutoYaST::UsersProfileReader do
  subject { described_class.new(Yast::ProfileHash.new(profile)) }

  let(:root) { { "username" => "root", "user_password" => "123456", "encrypted" => false } }
  let(:user) { { "username" => "suse", "fullname" => "SUSE", "user_password" => "nots3cr3t" } }
  let(:nobody) { { "username" => "nobody" } }

  describe "#root" do
    context "when there is no 'users' section" do
      let(:profile) { {} }

      it "returns nil" do
        expect(subject.root).to be_nil
      end
    end

    context "when no root user is defined" do
      let(:profile) { { "users" => [user] } }

      it "returns nil" do
        expect(subject.root).to be_nil
      end
    end

    context "when a root user is defined" do
      let(:profile) { { "users" => [root, user] } }

      it "returns its profile hash" do
        expect(subject.root).to eq(root)
      end
    end
  end

  describe "#regular_user" do
    context "when there is no 'users' section" do
      let(:profile) { {} }

      it "returns nil" do
        expect(subject.regular_user).to be_nil
      end
    end

    context "when only a root user is defined" do
      let(:profile) { { "users" => [root] } }

      it "returns nil" do
        expect(subject.regular_user).to be_nil
      end
    end

    context "when a regular user is defined" do
      let(:profile) { { "users" => [root, user] } }

      it "returns its profile hash" do
        expect(subject.regular_user).to eq(user)
      end
    end

    context "when the only non-root user is 'nobody'" do
      let(:profile) { { "users" => [root, nobody] } }

      it "returns nil" do
        expect(subject.regular_user).to be_nil
      end
    end

    context "when there are several regular users" do
      let(:other_user) { { "username" => "other" } }
      let(:profile) { { "users" => [root, user, other_user] } }

      it "returns the first one" do
        expect(subject.regular_user).to eq(user)
      end
    end
  end
end
