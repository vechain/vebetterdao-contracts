SHELL := /bin/bash

help:
	@egrep -h '\s#@\s' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?#@ "}; {printf "\033[36m  %-30s\033[0m %s\n", $$1, $$2}'

# Thor solo
solo-up: #@ Start Thor solo
	docker compose -f packages/contracts/docker-compose.yaml up -d --wait 
solo-down: #@ Stop Thor solo
	docker compose -f packages/contracts/docker-compose.yaml down
solo-clean: #@ Clean Thor solo
	docker compose -f packages/contracts/docker-compose.yaml down -v --remove-orphans

NAV_CONTRACTS=cd packages/contracts

# Contracts
contracts-compile: #@ Compile the contracts.
	$(NAV_CONTRACTS); yarn compile
contracts-deploy: contracts-compile solo-up #@ Deploy the contracts.
	$(NAV_CONTRACTS); yarn deploy
contracts-test: contracts-compile #@ Test the contracts.
	$(NAV_CONTRACTS); yarn test

# Apps
install: #@ Install the dependencies.
	yarn install
build: install #@ Build the app.
	yarn build
test: #@ Test the app.
	yarn test
.PHONY:build

# spins up a local instance of thor solo, builds the app and runs it in dev mode
# the env config used is defined by ENV input param
# !!! NOTE !!!: existing instance of thor solo will be removed along with its data volume
# example: make up ENV=e2e
up:
	make solo-down
	@if ![ -e ./.env ]; then cp .env.example .env; fi
	# if exists - remove the old thor image and its data volume
	@if [ -n "$$(docker images -q vechain/thor)" ]; then docker rmi $$(docker images -q vechain/thor); fi
	@if [ -n "$$(docker volume ls -q -f name=thor-data)" ]; then docker volume rm thor-data; fi
	yarn install
	make solo-up
	yarn build
	@if [ -e ./packages/config/local.ts ]; then rm ./packages/config/local.ts; fi
	yarn dev:$(ENV)