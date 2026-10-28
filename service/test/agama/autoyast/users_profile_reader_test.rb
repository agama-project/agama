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
  let(:sys_uid_max) { 499 }

  before do
    allow(Yast::ShadowConfig).to receive(:fetch).with(:sys_uid_max).and_return(sys_uid_max)
  end

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

    context "when the only non-root user has an explicit uid below SYS_UID_MAX" do
      let(:service_account) { { "username" => "srvaccount", "uid" => "111" } }
      let(:profile) { { "users" => [root, service_account] } }

      it "returns nil" do
        expect(subject.regular_user).to be_nil
      end
    end

    context "when the only non-root user has an explicit uid equal to SYS_UID_MAX" do
      let(:service_account) { { "username" => "srvaccount", "uid" => sys_uid_max.to_s } }
      let(:profile) { { "users" => [root, service_account] } }

      it "returns nil" do
        expect(subject.regular_user).to be_nil
      end
    end

    context "when the only non-root user has an explicit uid above SYS_UID_MAX" do
      let(:regular_account) { { "username" => "srvaccount", "uid" => (sys_uid_max + 1).to_s } }
      let(:profile) { { "users" => [root, regular_account] } }

      it "returns its profile hash" do
        expect(subject.regular_user).to eq(regular_account)
      end
    end

    context "when SYS_UID_MAX cannot be determined (e.g. missing login.defs)" do
      let(:sys_uid_max) { nil }
      let(:service_account) { { "username" => "srvaccount", "uid" => "111" } }
      let(:profile) { { "users" => [root, service_account] } }

      it "does not filter out users based on their uid" do
        expect(subject.regular_user).to eq(service_account)
      end
    end
  end
end
