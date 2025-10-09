# frozen_string_literal: true

RSpec.describe ::DiscourseRankOnNames::AdminPrefixesController, type: :request do
  fab!(:admin) { Fabricate(:admin) }

  before { sign_in(admin) }

  def prefix_payload(attrs = {})
    {
      prefix: {
        group_name: "Test_Group",
        prefix: "TG",
        position: 99,
      }.merge(attrs),
    }
  end

  it "lists prefixes" do
    get "/admin/plugins/rank-on-names/prefixes.json"
    expect(response.status).to eq(200)
    expect(response.parsed_body["prefixes"]).to be_an(Array)
  end

  it "creates a prefix" do
    expect {
      post "/admin/plugins/rank-on-names/prefixes.json", params: prefix_payload
    }.to change { ::DiscourseRankOnNames::Prefix.count }.by(1)

    expect(response.status).to eq(200)
    body = response.parsed_body
    expect(body["group_name"]).to eq("Test_Group")
    expect(body["prefix"]).to eq("TG")
  end

  it "updates a prefix" do
    prefix = ::DiscourseRankOnNames::Prefix.create!(
      group_name: "Test_Group",
      prefix: "TG",
      position: 10
    )

    put "/admin/plugins/rank-on-names/prefixes/#{prefix.id}.json",
        params: prefix_payload(prefix: "TG-Updated", position: 5)

    expect(response.status).to eq(200)
    expect(prefix.reload.prefix).to eq("TG-Updated")
    expect(prefix.position).to eq(5)
  end

  it "deletes a prefix" do
    prefix = ::DiscourseRankOnNames::Prefix.create!(
      group_name: "Test_Group",
      prefix: "TG",
      position: 10
    )

    expect {
      delete "/admin/plugins/rank-on-names/prefixes/#{prefix.id}.json"
    }.to change { ::DiscourseRankOnNames::Prefix.count }.by(-1)

    expect(response.status).to eq(200)
  end
end
