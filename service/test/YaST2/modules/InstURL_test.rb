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
    context "when ZyppRepoURL is set in install.inf" do
      before do
        allow(Yast::Linuxrc).to receive(:InstallInf).with("ZyppRepoURL")
          .and_return(+"http://example.com/repo")
        allow(Yast::Linuxrc).to receive(:InstallInf).with("ssl_verify").and_return(nil)
      end

      it "returns that URL" do
        expect(subject.installInf2Url).to eq("http://example.com/repo")
      end

      it "caches the result for subsequent calls" do
        subject.installInf2Url
        expect(Yast::Linuxrc).to_not receive(:InstallInf)
        subject.installInf2Url
      end

      context "and an extra directory is given" do
        it "appends it to the URL path" do
          expect(subject.installInf2Url("extra")).to eq("http://example.com/repo/extra")
        end
      end

      context "and the URL contains spaces" do
        before do
          allow(Yast::Linuxrc).to receive(:InstallInf).with("ZyppRepoURL")
            .and_return(+"http://example.com/my repo")
        end

        it "escapes them" do
          expect(subject.installInf2Url).to eq("http://example.com/my%20repo")
        end
      end

      context "and the URL uses the https scheme" do
        before do
          allow(Yast::Linuxrc).to receive(:InstallInf).with("ZyppRepoURL")
            .and_return(+"https://example.com/repo")
        end

        context "and ssl_verify is not disabled in install.inf" do
          it "does not add the ssl_verify option" do
            expect(subject.installInf2Url).to eq("https://example.com/repo")
          end
        end

        context "and ssl_verify is set to 'no' in install.inf" do
          before do
            allow(Yast::Linuxrc).to receive(:InstallInf).with("ssl_verify").and_return("no")
          end

          it "adds the ssl_verify=no option" do
            expect(subject.installInf2Url).to eq("https://example.com/repo?ssl_verify=no")
          end
        end
      end
    end

    context "when ZyppRepoURL is not set in install.inf" do
      before do
        allow(Yast::Linuxrc).to receive(:InstallInf).with("ZyppRepoURL").and_return(nil)
      end

      context "and the fallback repository does not exist" do
        before do
          allow(File).to receive(:exist?).with("/var/lib/fallback-repo").and_return(false)
        end

        it "returns an empty string" do
          expect(subject.installInf2Url).to eq("")
        end
      end

      context "and the fallback repository exists" do
        before do
          allow(File).to receive(:exist?).with("/var/lib/fallback-repo").and_return(true)
        end

        it "returns the fallback repository URL" do
          expect(subject.installInf2Url).to eq("dir:///var/lib/fallback-repo")
        end
      end
    end
  end
end
