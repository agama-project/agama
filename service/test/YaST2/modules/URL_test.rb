#!/usr/bin/env rspec

require_relative "test_helper"

Yast.import "URL"

describe Yast::URL do
  subject { Yast::URL }

  let(:url) { "https://myuser:mypassword@suse.de:1234/some-path?preview=true#contents" }
  let(:tokens) do
    {
      "scheme"   => "https",
      "host"     => "suse.de",
      "path"     => "/some-path",
      "fragment" => "contents",
      "user"     => "myuser",
      "pass"     => "mypassword",
      "port"     => "1234",
      "query"    => "preview=true"
    }
  end

  describe ".Parse" do
    context "given a http(s) URL" do
      it "returns a hash containing the token extracted from the URL" do
        expect(subject.Parse(url)).to eq(tokens)
      end

      it "returns url with changed user" do
        url = subject.Parse(
          "http://name:pass@www.suse.cz:80/path/index.html?question#part"
        )
        url["user"] = "user:1@domain"
        expect(subject.Build(url)).to eq("http://user%3a1%40domain:pass@www.suse.cz:80/path/index.html?question#part")
      end
    end

    context "given a CD/DVD with a file" do
      let(:url) { "cd:/some/file" }
      let(:tokens) do
        {
          "scheme"   => "cd",
          "host"     => "",
          "path"     => "/some/file",
          "fragment" => "",
          "user"     => "",
          "pass"     => "",
          "port"     => "",
          "query"    => ""
        }
      end

      it "returns a hash containing 'scheme' and 'path'" do
        expect(subject.Parse(url)).to eq(tokens)
      end
    end

    context "given a CD/DVD with a device" do
      let(:url) { "cd:/?device=/dev/sr0" }
      let(:tokens) do
        {
          "scheme"   => "cd",
          "host"     => "",
          "path"     => "/",
          "fragment" => "",
          "user"     => "",
          "pass"     => "",
          "port"     => "",
          "query"    => "device=/dev/sr0"
        }
      end

      it "returns a hash containing 'scheme', 'path' and 'query'" do
        expect(subject.Parse(url)).to eq(tokens)
      end
    end

    context "given a CD/DVD with a device and a path" do
      let(:url) { "cd:/some/file?device=/dev/sr0" }
      let(:tokens) do
        {
          "scheme"   => "cd",
          "host"     => "",
          "path"     => "/some/file",
          "fragment" => "",
          "user"     => "",
          "pass"     => "",
          "port"     => "",
          "query"    => "device=/dev/sr0"
        }
      end

      it "returns a hash containing 'scheme', 'path' and 'query'" do
        expect(subject.Parse(url)).to eq(tokens)
      end
    end

    context "given a Samba device and a path" do
      let(:samba_url) { "smb://username:passwd@servername/share/path/on/the/share?mountoptions=ro&workgroup=group" }
      it "returns samba host" do
        SAMBA_URL = {
          "domain"   => "group",
          "fragment" => "",
          "host"     => "servername",
          "pass"     => "passwd",
          "path"     => "/share/path/on/the/share",
          "port"     => "",
          "query"    => "mountoptions=ro&workgroup=group",
          "scheme"   => "smb",
          "user"     => "username"
        }.freeze
        expect(subject.Parse(samba_url)).to eq(SAMBA_URL)
      end
    end

    context "given an IPv6 URL" do
      it "returns IPv6 host" do
        IPV6_URL = {
          "fragment" => "",
          "host"     => "2001:de8:0:f123::1",
          "pass"     => "",
          "path"     => "/path/to/dir",
          "port"     => "",
          "query"    => "",
          "scheme"   => "http",
          "user"     => ""
        }.freeze
        expect(subject.Parse("http://[2001:de8:0:f123::1]/path/to/dir")).to eq(IPV6_URL)
      end

      it "returns IPv6 host with user/password, port" do
        IPV6_URL_PORT = {
          "fragment" => "",
          "host"     => "2001:de8:0:f123::1",
          "pass"     => "password",
          "path"     => "/path/to/dir",
          "port"     => "8080",
          "query"    => "",
          "scheme"   => "http",
          "user"     => "user"
        }.freeze
        expect(subject.Parse("http://user:password@[2001:de8:0:f123::1]:8080/path/to/dir")).to eq(IPV6_URL_PORT)
      end
    end
  end

  describe ".Build" do
    it "returns the URL for the given tokens" do
      expect(subject.Build(tokens)).to eq(url)
    end

    it "returns valid URL string" do
      expect(subject.Build("scheme" => "ftp",
        "host"   => "ftp.example.com",
        "path"   => "path/to/dir")).to eq(
                             "ftp://ftp.example.com/path/to/dir"
                           )
    end

    it "returns URL string with escaped leading / in the path" do
      expect(subject.Build("scheme" => "ftp",
        "host"   => "ftp.example.com",
        "path"   => "/path/to/dir")).to eq(
                             "ftp://ftp.example.com/%2fpath/to/dir"
                           )
    end

    it "returns URL string with escaped leading // in the path" do
      expect(subject.Build("scheme" => "ftp",
        "host"   => "ftp.example.com",
        "path"   => "//path/to/dir")).to eq(
                             "ftp://ftp.example.com/%2fpath/to/dir"
                           )
    end

    it "returns URL string with escaped leading /// in the path" do
      expect(subject.Build("scheme" => "ftp",
        "host"   => "ftp.example.com",
        "path"   => "///path/to/dir")).to eq(
                             "ftp://ftp.example.com/%2fpath/to/dir"
                           )
    end

    it "returns URL string with escaped leading /// in the path and params" do
      expect(subject.Build("scheme" => "ftp",
        "host"   => "ftp.example.com",
        "query"  => "param1=val1&param2=val2",
        "path"   => "///path/to/dir")).to eq(
                             "ftp://ftp.example.com/%2fpath/to/dir?param1=val1&param2=val2"
                           )
    end

    it "returns URL string with escaped non-ASCII chars in the path" do
      # bnc#446395
      expect(subject.Build("scheme" => "dir",
        "path"   => "/path/to/\u011B\u0161\u010D\u0159\u017E\u00FD\u00E1\u00ED\u00E9/dir")).to eq(
                             "dir:///path/to/%c4%9b%c5%a1%c4%8d%c5%99%c5%be%c3%bd%c3%a1%c3%ad%c3%a9/dir"
                           )
    end

    it "returns URL string with nonescaped ':' in the path" do
      # bnc#966413
      expect(subject.Build("scheme" => "nfs",
        "host"   => "test.suse.de",
        "path"   => "dist/ibs/SUSE:/SLE-SP1:/GA/images/iso/test.iso")).to eq(
                             "nfs://test.suse.de/dist/ibs/SUSE:/SLE-SP1:/GA/images/iso/test.iso"
                           )
    end

    context "given IPv6 host" do
      it "returns ftp URL string with IPv6 host" do
        expect(subject.Build("scheme" => "ftp",
          "host"   => "2001:de8:0:f123::1",
          "path"   => "///path/to/dir")).to eq(
                               "ftp://[2001:de8:0:f123::1]/%2fpath/to/dir"
                             )
      end

      it "returns http URL string with IPv6 host" do
        expect(subject.Build("scheme" => "http",
          "host"   => "2001:de8:0:f123::1",
          "port"   => "8080",
          "path"   => "///path/to/dir")).to eq(
                               "http://[2001:de8:0:f123::1]:8080/path/to/dir"
                             )
      end
    end

    context "given Samba host" do
      it "returns samba URL string" do
        # bnc#491482
        expect(subject.Build("domain" => "workgroup",
          "host"   => "myserver.com",
          "pass"   => "passwd",
          "path"   => "/share$$share/path/on/the/share",
          "scheme" => "smb",
          "user"   => "username")).to eq(
                               "smb://username:passwd@myserver.com/share$$share/path/on/the/share?workgroup=workgroup"
                             )
      end
    end

    context "given CD/DVD tokens including a device" do
      context "with a device" do
        let(:tokens) do
          {
            "scheme" => "cd",
            "query"  => "device=/dev/sr0",
            "path"   => "/"
          }
        end

        it "returns a URL of the form 'cd:///?<device>'" do
          expect(subject.Build(tokens)).to eq("cd:///?device=/dev/sr0")
        end
      end

      context "with a directory" do
        let(:tokens) do
          {
            "scheme" => "cd",
            "path"   => "/dir"
          }
        end

        it "returns a URL of the form 'cd:///<dir>'" do
          expect(subject.Build(tokens)).to eq("cd:///dir")
        end
      end
    end
  end

  describe "URLs rebuilding" do
    # This intention of these tests is to check if URLs are rebuilt correctly.

    URLS = {
      "dvd:/dir"                                                                                 => "dvd:///dir",
      "dvd://dir"                                                                                => "dvd:///dir",
      "dvd:///dir"                                                                               => "dvd:///dir",
      "cd:/?device=/dev/sr0"                                                                     => "cd:///?device=/dev/sr0",
      "cd:/some/file?device=/dev/sr0"                                                            => "cd:///some/file?device=/dev/sr0",
      "cd:///some/file?device=/dev/sr0"                                                          => "cd:///some/file?device=/dev/sr0",
      "http://u:p@suse.de/a#b"                                                                   => "http://u:p@suse.de/a#b",
      "ftp://u:p@suse.de/a#b"                                                                    => "ftp://u:p@suse.de/a#b",
      "dir:///"                                                                                  => "dir:///",
      "http://na%40me:pa%3F%3fss@www.suse.cz:80/path/index.html?question#part"                   => "http://na%40me:pa%3f%3fss@www.suse.cz:80/path/index.html?question#part",
      "http://user:password@[2001:de8:0:f123::1]:8080/path/to/dir"                               => "http://user:password@[2001:de8:0:f123::1]:8080/path/to/dir",
      "http://name:pass@www.suse.cz:80/path/index.html?question#part"                            => "http://name:pass@www.suse.cz:80/path/index.html?question#part",
      "smb://username:passwd@servername/share/path/on/the/share?mountoptions=ro&workgroup=group" => "smb://username:passwd@servername/share/path/on/the/share?mountoptions=ro&workgroup=group",
      "slp:/"                                                                                    => "slp://",
      "dir:/"                                                                                    => "dir:///",
      "iso:/"                                                                                    => "iso:///",
      "hd:/"                                                                                     => "hd:///",
      "cd:/"                                                                                     => "cd:///",
      "dvd:/"                                                                                    => "dvd:///"
    }.freeze

    URLS.each do |url, rebuilt|
      it "returns '#{rebuilt}' for '#{url}'" do
        expect(subject.Build(subject.Parse(url))).to eq(rebuilt)
      end
    end
  end

  describe ".EscapeString" do
    it "returns empty string if the url is nil" do
      expect(subject.EscapeString(nil, subject.transform_map_passwd)).to eq("")
    end

    it "returns empty string if the url is empty too" do
      expect(subject.EscapeString("", subject.transform_map_passwd)).to eq("")
    end

    it "returns url without any special character" do
      expect(subject.EscapeString("abcd", subject.transform_map_passwd)).to eq("abcd")
    end

    it "returns string with escaped %" do
      expect(subject.EscapeString("abcd%", subject.transform_map_passwd)).to eq("abcd%25")
    end

    it "returns escaped $" do
      expect(subject.EscapeString("ab%c$d", subject.transform_map_passwd)).to eq("ab%25c%24d")
    end

    it "returns escaped blanks" do
      expect(subject.EscapeString(" %$ ", subject.transform_map_passwd)).to eq("%20%25%24%20")
    end

    it "returns not escaped _<>{}" do
      expect(subject.EscapeString("_<>{}", subject.transform_map_passwd)).to eq("_<>{}")
    end

    it "returns escaped %" do
      expect(subject.EscapeString("%", subject.transform_map_passwd)).to eq("%25")
    end
  end

  describe ".UnEscapeString" do
    it "returns empty string if the url is nil" do
      expect(subject.UnEscapeString(nil, subject.transform_map_passwd)).to eq("")
    end

    it "returns empty string if the url is empty too" do
      expect(subject.UnEscapeString("", subject.transform_map_passwd)).to eq("")
    end

    it "returns url without any special character" do
      expect(subject.UnEscapeString("abcd", subject.transform_map_passwd)).to eq("abcd")
    end

    it "returns string with unescaped %,/" do
      expect(subject.UnEscapeString("ab%2fcd%25", subject.transform_map_passwd)).to eq("ab/cd%")
    end

    it "returns unescaped @,%" do
      expect(subject.UnEscapeString("ab%40%25", subject.transform_map_passwd)).to eq("ab@%")
    end

    it "returns unescaped @" do
      expect(subject.UnEscapeString("%40", subject.transform_map_passwd)).to eq("@")
    end

    it "returns not (un)escaped _<>{}" do
      expect(subject.UnEscapeString("_<>{}", subject.transform_map_passwd)).to eq("_<>{}")
    end
  end

  describe ".FormatURL" do
    let(:long_url) { "http://download.opensuse.org/very/log/path/which/will/be/truncated/target_file" }
    it "returns not truncated URL string" do
      expect(subject.FormatURL(subject.Parse(long_url), 200)).to eq(
        "http://download.opensuse.org/very/log/path/which/will/be/truncated/target_file"
      )
    end

    it "returns truncated URL string" do
      expect(subject.FormatURL(subject.Parse(long_url), 15)).to eq(
        "http://download.opensuse.org/.../target_file"
      )
    end

    it "returns truncated URL string" do
      expect(subject.FormatURL(subject.Parse(long_url), 45)).to eq(
        "http://download.opensuse.org/.../target_file"
      )
    end

    it "returns truncated URL string" do
      expect(subject.FormatURL(subject.Parse(long_url), 65)).to eq(
        "http://download.opensuse.org/very/.../be/truncated/target_file"
      )
    end
  end
end
