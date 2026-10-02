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

require_relative "../../../test_helper"
require "y2iscsi_client/authentication"

# NOTE: this class has no dedicated upstream test at all - the only upstream reference is an
# incidental `let(:auth) { Y2IscsiClient::Authentication.new }` fixture inside
# yast2-iscsi-client's iscsi_client_lib_test.rb, used while testing IscsiClientLib#discover, not a
# focused unit test of Authentication's own API. This spec was written from scratch while
# vendoring (see service/YaST2/README.md).
describe Y2IscsiClient::Authentication do
  subject(:auth) { described_class.new }

  describe "#initialize" do
    it "starts with empty username/password values" do
      expect(auth.username).to eq("")
      expect(auth.username_in).to eq("")
      expect(auth.password).to eq("")
      expect(auth.password_in).to eq("")
    end

    it "does not consider it configured for CHAP" do
      expect(auth.chap?).to eq(false)
      expect(auth.by_target?).to eq(false)
      expect(auth.by_initiator?).to eq(false)
    end
  end

  describe ".new_from_legacy" do
    context "when the hash has no explicit authmethod" do
      let(:values) do
        { "username" => "noone", "password" => "secret" }
      end

      it "sets username/password from the hash" do
        auth = described_class.new_from_legacy(values)

        expect(auth.username).to eq("noone")
        expect(auth.password).to eq("secret")
      end
    end

    context "when the hash has an explicit authmethod of CHAP" do
      let(:values) do
        { "authmethod" => "CHAP", "username" => "noone", "password" => "secret" }
      end

      it "sets username/password from the hash" do
        auth = described_class.new_from_legacy(values)

        expect(auth.username).to eq("noone")
        expect(auth.password).to eq("secret")
      end
    end

    context "when the hash has an explicit authmethod other than CHAP" do
      let(:values) do
        { "authmethod" => "None", "username" => "noone", "password" => "secret" }
      end

      it "ignores the usernames and passwords" do
        auth = described_class.new_from_legacy(values)

        expect(auth.username).to eq("")
        expect(auth.password).to eq("")
      end
    end

    context "when the hash also includes initiator (bidirectional) credentials" do
      let(:values) do
        {
          "username"    => "noone",
          "password"    => "secret",
          "username_in" => "someone",
          "password_in" => "shared secret"
        }
      end

      it "sets both the target and initiator credentials" do
        auth = described_class.new_from_legacy(values)

        expect(auth.username).to eq("noone")
        expect(auth.password).to eq("secret")
        expect(auth.username_in).to eq("someone")
        expect(auth.password_in).to eq("shared secret")
      end
    end
  end

  describe "#by_target?" do
    context "when both username and password are set" do
      before do
        auth.username = "noone"
        auth.password = "secret"
      end

      it "returns true" do
        expect(auth.by_target?).to eq(true)
      end
    end

    context "when only the username is set" do
      before { auth.username = "noone" }

      it "returns false" do
        expect(auth.by_target?).to eq(false)
      end
    end

    context "when neither username nor password are set" do
      it "returns false" do
        expect(auth.by_target?).to eq(false)
      end
    end
  end

  describe "#chap?" do
    it "is an alias for #by_target?" do
      expect(auth.method(:chap?)).to eq(auth.method(:by_target?))
    end
  end

  describe "#by_initiator?" do
    context "when target credentials are not set" do
      before do
        auth.username_in = "someone"
        auth.password_in = "shared secret"
      end

      it "returns false, regardless of the initiator credentials" do
        expect(auth.by_initiator?).to eq(false)
      end
    end

    context "when target credentials are set" do
      before do
        auth.username = "noone"
        auth.password = "secret"
      end

      context "and both initiator username and password are set" do
        before do
          auth.username_in = "someone"
          auth.password_in = "shared secret"
        end

        it "returns true" do
          expect(auth.by_initiator?).to eq(true)
        end
      end

      context "and only the initiator username is set" do
        before { auth.username_in = "someone" }

        it "returns false" do
          expect(auth.by_initiator?).to eq(false)
        end
      end

      context "and no initiator credentials are set" do
        it "returns false" do
          expect(auth.by_initiator?).to eq(false)
        end
      end
    end
  end

  describe "secret attributes" do
    # NOTE: deliberately avoid the substring "secret" in the password values themselves, since
    # that's also the word Yast2::SecretAttributes uses as a placeholder (e.g. "<secret>") when
    # masking a value - using it here would make the "not exposed" assertions pass vacuously.
    before do
      auth.password = "noone-s-pwd"
      auth.password_in = "another-pwd"
    end

    it "does not expose the password values via #inspect" do
      expect(auth.inspect).to_not include("noone-s-pwd")
      expect(auth.inspect).to_not include("another-pwd")
    end

    it "still allows reading the password values directly" do
      expect(auth.password).to eq("noone-s-pwd")
      expect(auth.password_in).to eq("another-pwd")
    end
  end
end
