# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "agama/software/manager"
require "agama/software/callbacks/pkg_gpg_check"

describe Agama::Software::Callbacks::PkgGpgCheck do
  subject { described_class.new(questions_client, logger) }

  let(:questions_client) { instance_double(Agama::DBus::Clients::Questions) }
  let(:logger) { Logger.new($stdout, level: :error) }

  describe "#pkg_gpg_check" do
    # libzypp GPG check result
    let(:check_result) do
      {
        "CheckPackageResult" => result_code,
        "Package"            => "foo",
        "RepoMediaUrl"       => repo_url
      }
    end
    let(:repo_url) { "http://example.com" }
    let(:boot_params) { {} }

    before do
      # set the boot parameters
      allow(Agama::CmdlineArgs).to receive(:read).and_return(Agama::CmdlineArgs.new(boot_params))
    end

    context "when GPG check succeeds" do
      let(:result_code) { Agama::Software::Callbacks::PkgGpgCheck::CHK_OK }

      it "requests no action" do
        expect(subject.pkg_gpg_check(check_result)).to eq("")
      end
    end

    context "when the used GPG key is unknown" do
      let(:result_code) { Agama::Software::Callbacks::PkgGpgCheck::CHK_NOKEY }

      context "when no boot parameter is used" do
        context "the package comes from a regular repository" do
          it "requests no action" do
            expect(subject.pkg_gpg_check(check_result)).to eq("")
          end
        end

        context "the package comes from the DUD repository" do
          let(:repo_url) { Agama::Software::Manager.dud_repository_url }

          it "requests no action" do
            expect(subject.pkg_gpg_check(check_result)).to eq("")
          end
        end
      end

      context "when 'inst.dud_packages.gpg=0' boot parameter is used" do
        let(:boot_params) do
          {
            # emulate using the inst.dud_packages.gpg=0 boot option
            "dud_packages" => {
              "gpg" => "0"
            }
          }
        end

        context "the package comes from a regular repository" do
          # errors for regular packages are not ignored
          it "requests no action" do
            expect(subject.pkg_gpg_check(check_result)).to eq("")
          end
        end

        context "the package comes from the DUD repository" do
          let(:repo_url) { Agama::Software::Manager.dud_repository_url }

          # only errors for the DUD packages are ignored
          it "requests to ignore the GPG signature problem" do
            expect(subject.pkg_gpg_check(check_result)).to eq("I")
          end
        end
      end
    end
  end
end
