# frozen_string_literal: true

# TODO: remember to set up and test the --api option after all

require "cheetah"

# @param filename relative to git repo root
# @return usable for this suite
def fixture(filename)
  # the tests specify the paths relative to repo root
  # but we run in service/
  "../" + filename
end

# @param filename relative to git repo root
# @return usable for this suite, absolute
def abs_fixture(filename)
  File.absolute_path(fixture(filename))
end

def cheetah_kwargs
  {
    stdout:             :capture,
    stderr:             :capture,
    allowed_exitstatus: 0..255
  }
end

# needs declarations:
# command [Array<String>] like ["agama", "profile", "validate"]
shared_examples "accepts input in 3 ways" do |filename, output_match|
  context "with #{filename} as path" do
    it "output matches" do
      output = Cheetah.run(*command, fixture(filename), stdout: :capture)
      expect(output).to include(output_match)
    end
  end

  context "with #{filename} as URL" do
    it "output matches" do
      url = "file://" + abs_fixture(filename)
      output = Cheetah.run(*command, url, stdout: :capture)
      expect(output).to include(output_match)
    end
  end

  context "with #{filename} as stdin" do
    it "output matches" do
      input = File.read(fixture(filename))
      output = Cheetah.run(*command, "-", stdout: :capture, stdin: input)
      expect(output).to include(output_match)
    end
  end
end

describe "agama profile" do
  before do
    # Maybe run agama auth login, or read the auth token...
    # But that is not needed if
    # 1. the client can read the server token
    # 2. and the server token has not expired (1 day) yet
  end

  describe "validate:" do
    let(:command) { ["agama", "profile", "validate"] }
    context "valid profile" do
      include_examples \
        "accepts input in 3 ways", \
        "rust/agama-lib/share/examples/profile_tw_minimal.json", \
        "is valid"
    end

    context "valid profile with space in path" do
      include_examples \
        "accepts input in 3 ways", \
        "rust/agama-lib/share/examples space/profile_tw_minimal.json", \
        "is valid"
    end

    # Rust Url library will see the percent
    # and wrongly think that the path does not need escaping.
    # This is a bug but its impact is low.
    xcontext "valid profile with percent in path" do
      include_examples \
        "accepts input in 3 ways", \
        "rust/agama-lib/share/examples%20percent/profile_tw_minimal.json", \
        "is valid"
    end

    context "invalid profile" do
      include_examples \
        "accepts input in 3 ways", \
        "rust/agama-lib/share/examples/profile_tw_invalid.json", \
        "* Additional properties are not allowed ('ID' was unexpected). /product"
    end
  end

  describe "evaluate:" do
    context "jsonnet, by stdin" do
      let(:profile_body) { '{product: {uh: "oh"}}' }

      it "is evaluated" do
        output = Cheetah.run("agama", "profile", "evaluate", "-",
          stdout: :capture, stdin: profile_body)
        expected = <<~JSON
          {
             "product": {
                "uh": "oh"
             }
          }
        JSON
        expect(output).to eq(expected)
      end
    end
  end

  describe "autoyast:" do
    let(:command) { ["agama", "profile", "autoyast"] }

    let(:output_match) do
      json = <<~JSON
        {
          "product": {
            "id": "Tumbleweed"
          },
          "software": {
            "patterns": [
              "base"
            ],
            "packages": []
          }
        }
      JSON
      json
    end

    # I want to test that YaST special schemes like label:
    # are handled, but unable to make them work in my testing environment
    xcontext "XML, with a YaST special URL" do
      let(:filename) { "service/test/fixtures/profiles/trivial_tw.xml" }
      let(:label_url) { "label://mylabel#{abs_fixture(filename)}" }
    end

    context "XML, with file:/// URL" do
      let(:filename) { "service/test/fixtures/profiles/trivial_tw.xml" }

      it "output matches" do
        url = "file://" + abs_fixture(filename)
        output = Cheetah.run(*command, url, stdout: :capture)
        expect(output).to include(output_match)
      end
    end

    context "ERB, with file:/// URL" do
      let(:filename) { "service/test/fixtures/profiles/trivial_tw.xml.erb" }

      it "output matches" do
        url = "file://" + abs_fixture(filename)
        output = Cheetah.run(*command, url, stdout: :capture)
        expect(output).to include(output_match)
      end
    end

    # I get a deadlock because two processes want the libstorage lock. why?
    xcontext ".../, with file:/// URL" do
      let(:filename) { "service/test/fixtures/profiles/profile/" }

      it "output matches" do
        url = "file://" + abs_fixture(filename)
        output = Cheetah.run(*command, url, stdout: :capture)
        # this claim is too weak but the test needs to be fixed first
        expect(output).to include("Tumbleweed")
      end
    end
  end

  describe "import:" do
    let(:command) { ["agama", "profile", "import"] }

    context "script, with file:/// URL" do
      let(:filename) { "service/test/fixtures/profiles/smoke-test.sh" }

      it "is executed without error, quickly" do
        url = "file://" + abs_fixture(filename)
        start_time = Time.now
        _output, err_output, _status = Cheetah.run(*command, url, **cheetah_kwargs)
        end_time = Time.now
        expect(err_output).to be_empty
        # On its own, the script would run for 10s
        expect(end_time - start_time).to be < 2,
          "Service should not wait for a long running script"
      end
    end

    context "failing script, with file:/// URL" do
      let(:filename) { "service/test/fixtures/profiles/smoke-test-fail.sh" }

      it "reports a quick failure" do
        url = "file://" + abs_fixture(filename)
        _output, err_output, _status = Cheetah.run(*command, url, **cheetah_kwargs)
        expect(err_output).to include("failed quickly with exit status")
      end
    end
  end
end
