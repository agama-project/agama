# frozen_string_literal: true

Rails.application.routes.draw do
  get "properties/:name", to: "properties#show"
  put "properties/:name", to: "properties#update"
  get "properties", to: "properties#index"

  post "calls", to: "calls#create"

  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Defines the root path route ("/")
  # root "articles#index"
end
