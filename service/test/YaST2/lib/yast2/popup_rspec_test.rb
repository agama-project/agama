require_relative "../test_helper"

require "yast2/popup"
require "yast2/popup_rspec"

describe "expect_to_show_popup_which_return" do
  it "returns parameter from popup" do
    expect_to_show_popup_which_return(:test)
    expect(Yast2::Popup.show("test")).to eq :test
  end

  it "let popup raise argument error if wrong arguments are passed" do
    expect_to_show_popup_which_return(:test)
    expect { Yast2::Popup.show("test", buttons: nil) }.to raise_error(ArgumentError)
  end
end
