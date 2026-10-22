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

# InstURL.rb has no upstream test at all - written from scratch, covering #installInf2Url (the
# only method actually called anywhere in Agama's closure, see service/YaST2/README.md).
#
# #installInf2Url used to read the "ZyppRepoURL"/"ssl_verify" options from /etc/install.inf
# (written by linuxrc), which does not exist in Agama at all (no classic linuxrc boot stage) - so
# it always takes the "ZyppRepoURL is not set" fallback branch now. See service/YaST2/README.md.

require_relative "../../test_helper"
require "uri"

Yast.import "InstURL"

describe Yast::InstURL do
  subject { Yast::InstURL }

  # InstURL memoizes the computed URL in @installInf2Url, so a fresh instance variable is needed
  # for every example.
  before do
    subject.instance_variable_set(:@installInf2Url, nil)
  end

  describe "#installInf2Url" do
    context "when the fallback repository does not exist" do
      before do
        allow(File).to receive(:exist?).with("/var/lib/fallback-repo").and_return(false)
      end

      it "returns an empty string" do
        expect(subject.installInf2Url).to eq("")
      end
    end

    context "when the fallback repository exists" do
      before do
        allow(File).to receive(:exist?).with("/var/lib/fallback-repo").and_return(true)
      end

      it "returns the fallback repository URL" do
        expect(subject.installInf2Url).to eq("dir:///var/lib/fallback-repo")
      end

      it "caches the result for subsequent calls" do
        subject.installInf2Url
        expect(File).to_not receive(:exist?)
        subject.installInf2Url
      end
    end
  end
end
