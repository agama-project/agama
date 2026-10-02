# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "y2iscsi_client/finish_client"

describe Y2IscsiClient::FinishClient do
  describe "#write" do
    before do
      Yast::Installation.destdir = "/mnt"
      allow(Yast::IscsiClientLib).to receive(:sessions).and_return sessions
      allow(File).to receive(:directory?).with("/etc/iscsi").and_return etc_exists
      allow(File).to receive(:directory?).with("/var/lib/iscsi").and_return var_exists
      allow(Dir).to receive(:[]).with("/etc/iscsi/*").and_return etc_content
      allow(Dir).to receive(:[]).with("/var/lib/iscsi/*").and_return var_content
    end

    # Yast::Installation is a real classic YaST singleton, not a test double - leaving destdir set
    # to "/mnt" would leak into whichever spec file happens to run next in the same process.
    after do
      Yast::Installation.destdir = "/"
    end

    let(:sessions) { [] }
    let(:etc_exists) { false }
    let(:var_exists) { false }
    let(:etc_content) { ["one", "two"] }
    let(:var_content) { ["three", "four"] }

    context "if there is an /etc/iscsi directory in the int-sys" do
      let(:etc_exists) { true }

      context "and there is also a /var/lib/iscsi directory" do
        let(:var_exists) { true }

        it "copies the content of both directories to the target system" do
          expect(::FileUtils).to receive(:mkdir_p).with("/mnt/etc/iscsi")
          expect(::FileUtils).to receive(:cp_r)
            .with(etc_content, "/mnt/etc/iscsi/", preserve: true)
          expect(::FileUtils).to receive(:mkdir_p).with("/mnt/var/lib/iscsi")
          expect(::FileUtils).to receive(:cp_r)
            .with(var_content, "/mnt/var/lib/iscsi/", preserve: true)

          subject.write
        end
      end

      context "but there is no /var/lib/iscsi directory" do
        let(:var_exists) { false }

        it "copies the content of /etc/iscsi to the target system" do
          expect(::FileUtils).to receive(:mkdir_p).with("/mnt/etc/iscsi")
          expect(::FileUtils).to receive(:cp_r).with(etc_content, "/mnt/etc/iscsi/", preserve: true)

          subject.write
        end

        it "does not copy /var/lib/iscsi" do
          expect(::FileUtils).to_not receive(:mkdir_p).with("/mnt/var/lib/iscsi")
          expect(::FileUtils).to_not receive(:cp_r).with(anything, "/mnt/var/lib/iscsi/", any_args)

          subject.write
        end
      end
    end

    context "if there is no /etc/iscsi directory in the int-sys" do
      let(:etc_exists) { false }

      context "but there is a /var/lib/iscsi directory" do
        let(:var_exists) { true }

        it "copies the content of /var/lib/iscsi to the target system" do
          expect(::FileUtils).to receive(:mkdir_p).with("/mnt/var/lib/iscsi")
          expect(::FileUtils).to receive(:cp_r)
            .with(var_content, "/mnt/var/lib/iscsi/", preserve: true)

          subject.write
        end

        it "does not copy /etc/iscsi" do
          expect(::FileUtils).to_not receive(:mkdir_p).with("/mnt/etc/iscsi")
          expect(::FileUtils).to_not receive(:cp_r).with(anything, "/mnt/etc/iscsi/", any_args)

          subject.write
        end
      end

      context "and there is no /var/lib/iscsi directory either" do
        let(:var_exists) { false }

        it "does not copy any file" do
          expect(::FileUtils).to_not receive(:mkdir_p)
          expect(::FileUtils).to_not receive(:cp_r)
          subject.write
        end
      end
    end

    context "if there are directories to be copied to the target system" do
      let(:etc_exists) { true }
      let(:var_exists) { true }

      it "fails gracefully (no exception or crash) if copying fails" do
        allow(::FileUtils).to receive(:mkdir_p)
        allow(::FileUtils).to receive(:cp_r).and_raise Errno::ENOENT

        expect { subject.write }.to_not raise_error
      end
    end

    context "if there are no active iSCSI sessions" do
      let(:sessions) { [] }

      it "does not modify any socket or service" do
        expect(Yast::Service).to_not receive(:Enable)
        expect(Yast2::Systemd::Socket).to_not receive(:find)

        subject.write
      end
    end

    context "if there are active iSCSI sessions" do
      let(:sessions) { ["1.1.1.1:2222 iqn.something default"] }

      before do
        allow(Yast2::Systemd::Socket).to receive(:find).with("iscsid").and_return(iscsid_socket)
        allow(Yast::Service).to receive(:Enable)
        allow(Yast::IscsiClientLib).to receive(:iscsiuio_relevant?).and_return uio
      end

      context "and the iscsiuio service is not needed" do
        let(:uio) { false }

        context "and the iscsid socket does not exist" do
          let(:iscsid_socket) { nil }

          it "enables the iscsid and iscsi services" do
            expect(Yast::Service).to receive(:Enable).with("iscsid")
            expect(Yast::Service).to receive(:Enable).with("iscsi")
            subject.write
          end

          it "it does not enable the iscsiuio service nor socket" do
            expect(Yast2::Systemd::Socket).to_not receive(:find).with("iscsiuio")
            expect(Yast::Service).to_not receive(:Enable).with("iscsiuio")
            subject.write
          end
        end

        context "and the iscsid socket exists" do
          let(:iscsid_socket) { instance_double(Yast2::Systemd::Socket, enable: true) }

          it "enables the iscsid socket and the iscsi service" do
            expect(iscsid_socket).to receive(:enable)
            expect(Yast::Service).to receive(:Enable).with("iscsi")
            subject.write
          end

          it "it does not enable the iscsiuio service nor socket" do
            expect(Yast2::Systemd::Socket).to_not receive(:find).with("iscsiuio")
            expect(Yast::Service).to_not receive(:Enable).with("iscsiuio")
            subject.write
          end

          it "it does not enable the iscsid service" do
            expect(Yast::Service).to_not receive(:Enable).with("iscsid")
            subject.write
          end
        end
      end

      context "and the iscsiuio service is needed" do
        let(:uio) { true }

        before do
          allow(Yast2::Systemd::Socket).to receive(:find).with("iscsiuio").and_return(uio_socket)
        end

        let(:uio_socket) { instance_double(Yast2::Systemd::Socket) }

        context "but the iscsid socket does not exist" do
          let(:iscsid_socket) { nil }

          it "enables the iscsid, iscsi and iscsiuio services" do
            expect(Yast::Service).to receive(:Enable).with("iscsid")
            expect(Yast::Service).to receive(:Enable).with("iscsi")
            expect(Yast::Service).to receive(:Enable).with("iscsiuio")
            subject.write
          end

          it "it does not enable the iscsiuio socket" do
            expect(uio_socket).to_not receive(:enable)
            subject.write
          end
        end

        context "and the iscsid socket exists" do
          let(:iscsid_socket) { instance_double(Yast2::Systemd::Socket, enable: true) }

          it "enables the iscsid socket and the iscsiuio and iscsi services" do
            expect(Yast::Service).to receive(:Enable).with("iscsi")
            expect(Yast::Service).to receive(:Enable).with("iscsiuio")
            expect(iscsid_socket).to receive(:enable)
            subject.write
          end

          it "it does not enable the iscsid services" do
            allow(Yast::Service).to receive(:Enable).with("iscsiuio")
            expect(Yast::Service).to_not receive(:Enable).with("iscsid")
            subject.write
          end
        end
      end
    end
  end
end
