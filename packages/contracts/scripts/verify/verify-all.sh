#!/bin/bash

# Check if network argument is provided
if [ "$1" != "mainnet" ] && [ "$1" != "testnet" ]; then
    echo "Usage: $0 <network>"
    echo "network: mainnet or testnet"
    exit 1
fi

NETWORK=$1

# Function to verify a contract
verify_contract() {
    local address=$1
    local contract_name=$2
    local is_proxy=${3:-false}
    
    echo "Verifying $contract_name at $address..."
    
    # Try exact match first
    if yarn contracts:verify:$NETWORK "$address" "$contract_name"; then
        echo "✅ Successfully verified $contract_name"
    else
        # If exact match fails, try partial match
        echo "Exact match failed, trying partial match..."
        if yarn contracts:verify:$NETWORK "$address" "$contract_name" --partial-match; then
            echo "✅ Successfully verified $contract_name (partial match)"
        else
            echo "❌ Failed to verify $contract_name"
            return 1
        fi
    fi
    return 0
}

# Function to verify a proxy and its implementation
verify_proxy_and_implementation() {
    local proxy_address=$1
    local implementation_address=$2
    local contract_name=$3
    
    # Verify proxy
    echo "Verifying proxy contract..."
    verify_contract "$proxy_address" "B3TRProxy" true
    
    # Verify implementation
    echo "Verifying implementation contract..."
    verify_contract "$implementation_address" "$contract_name"
}


echo "Verifying B3TR Governor Libraries..."
# B3TR Governor Libraries

# verify_contract "          IMPLEMENTATION ADDRESS        " "CONTRACT NAME"
verify_contract "0xed6137b125bc40834fa06e800c5a72013ef9d91c" "GovernorClockLogic"
verify_contract "0xc2428c4608f97d21034ae32f104587c9c045a8a2" "GovernorConfigurator"
verify_contract "0x00f1cf9847b149e594c23a15db0976a2ae0b49b2" "GovernorDepositLogic"
verify_contract "0x1a430095eed7f87f5b41a3025c1463f68bbc2a1e" "GovernorFunctionRestrictionsLogic"
verify_contract "0xe37a44f0ec996ef8618e083d9d7406db1ccc395d" "GovernorProposalLogic"
verify_contract "0xfbb42dc5e87105a270cab3422cc3e3b51b8af152" "GovernorQuorumLogic"
verify_contract "0x38e4cfebcc414902d2846b699224b26a10144ff1" "GovernorStateLogic"
verify_contract "0x5d340fa12d11a4bab44ce8c907380a47226ef44c" "GovernorVotesLogic"

echo "Verifying Passport Libraries..."

# Passport Libraries

# verify_contract "          IMPLEMENTATION ADDRESS        " "CONTRACT NAME"
verify_contract "0xDB5b259E4BfbfD8353cfcea695bbB583eE58F77a" "PassportChecksLogic"
verify_contract "0xCb35e190BecE6ED3BE22Ad911C511Ae2a751e3AC" "PassportConfigurator"
verify_contract "0x04f3a1e567dCC2a53eB9Fd07f6E42f69e4Ac372a" "PassportEntityLogic"
verify_contract "0x1dB402a8DDf4b804aF183340C93E3CD32D97546d" "PassportDelegationLogic"
verify_contract "0xF631c28c10530f2C6CD67b3Fe0ae349D55afF4F3" "PassportPersonhoodLogic"
verify_contract "0x92bccB35f911C89350e4D67fBBA8381290961981" "PassportPoPScoreLogic"
verify_contract "0x5EcD3ec6fe7105Cc51FECa599862C318Cd276aa6" "PassportSignalingLogic"
verify_contract "0x2D326f99e4251436F03eaab8b1af6875D984fD84" "PassportWhitelistAndBlacklistLogic"

echo "Verifying Contracts..."
# verify_proxy_and_implementation "             PROXY ADDRESS              " "            IMPLEMENTATION ADDRESS        " "CONTRACT NAME"
verify_proxy_and_implementation "0x76Ca782B59C74d088C7D2Cce2f211BC00836c602" "0x5A08100FAd9583Fd046d85014e5Cd4A235B48F81" "VOT3"
verify_proxy_and_implementation "0x1c65C25fABe2fc1bCb82f253fA0C916a322f777C" "0xb9965634dE7f1f8efB0D1D53B882C056E5eE9889" "B3TRGovernor"
verify_proxy_and_implementation "0x93B8cD34A7Fc4f53271b9011161F7A2B5fEA9D1F" "0x66Ad89A0739301F7Ad543dFDf0A94915EB78dd69" "GalaxyMember"
verify_proxy_and_implementation "0x8392B7CCc763dB03b47afcD8E8f5e24F9cf0554D" "0x8366EA725e660D6118Fa929701E4c55b58518003" "X2EarnApps"
verify_proxy_and_implementation "0x35a267671d8EDD607B2056A9a13E7ba7CF53c8b3" "0x2301D1662d14E945c99848083220896E4847b6ad" "VeBetterPassport"
verify_proxy_and_implementation "0xDf94739bd169C84fe6478D8420Bb807F1f47b135" "0x0c0142FDA79c3096952390bdCE376cF0a822737A" "Emissions"
verify_proxy_and_implementation "0x7B7EaF620d88E38782c6491D7Ce0B8D8cF3227e4" "0x9DeAA052CC9eA8d9D688F07841c4c11872d9cF4B" "TimeLock"
verify_proxy_and_implementation "0x4191776F05f4bE4848d3f4d587345078B439C7d3" "0xda9dda40C37439cfDE926cD145E1beFA2aE0dCD4" "XAllocationPool"
verify_proxy_and_implementation "0x89A00Bb0947a30FF95BEeF77a66AEdE3842Fe5B7" "0xd11C41448eb4D2dbe95B87A8fbA4bB4E480519e6" "XAllocationVoting"
verify_proxy_and_implementation "0x838A33AF756a6366f93e201423E1425f67eC0Fa7" "0x61e462bbA8F851109A0059dD8c09D474D08f7d7B" "VoterRewards"
verify_proxy_and_implementation "0xD5903BCc66e439c753e525F8AF2FeC7be2429593" "0x226a9E4AdDf96364685c378aA2A30CF11277BF53" "Treasury"
verify_proxy_and_implementation "0x6Bee7DDab6c99d5B2Af0554EaEA484CE18F52631" "0xB6BfED7519f9c22d58bBD7D3E2588ED46ca618b5" "X2EarnRewardsPool"
verify_proxy_and_implementation "0xe8e96a768ffd00417d4bd985bec9EcfC6F732a7f" "0xA567F07c067141a55ba3e0542487d265629E5b14" "X2EarnCreator"
verify_proxy_and_implementation "0x055d20914657834c914d7c44bf65b566ab4b45a2" "0x692B74936F777d124984e95ae2157aF42BCf877f" "GrantsManager"


echo "Verification process completed!"
