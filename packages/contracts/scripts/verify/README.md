# Contract Verification Script

A contract verification script that leverages Sourcify's latest v2 API endpoints.

Hardhat-verify plugin is inconsistent and does not work all the time. This script uses custom logic to verify contracts by interacting with the Sourcify v2 API, by:

- compiling the contracts
- extracting the metadata
- copying the source files into a temporary directory
- submitting the verification job
- polling the verification job
- handling the verification status

The scripts supports only VeChain Mainnet and Testnet.

## Usage

Run the script from the project root.

```bash
# Using the convenient yarn scripts
yarn contracts:verify:mainnet <contract-address> <contract-name>
```

### Examples

```bash
# Verify StargateNFT on testnet (exact_match)
yarn contracts:verify:testnet 0x1234567890123456789012345678901234567890 StargateNFT

# Verify NodeManagementV3 on mainnet (exact_match)
yarn contracts:verify:mainnet 0x1234567890123456789012345678901234567890 NodeManagementV3
```

### Options

- `--partial-match` - If exact_match verification fails, try match verification (metadata-only)

## Tips

When dealing with upgradeable contracts, you will need first to verify the Proxy contract by using the address of the proxy (that you use to interact with the contract) and the name of the proxy contract, eg: StargateProxy.

Then you need to verify the implementation contract code, so you will need to find the implementation address (from sourcify, vechainstats, or by looking at the Upgraded events in the contract) and the name of the implementation contract, eg: StargateNFT.

For projects using libraries, you will also need to verify each library contract.

## Troubleshooting

### Contract or Metadata Not Found

- Make sure the contract has been compiled (`yarn contracts:compile`)

### Bytecode Mismatch

- Try using the `--partial-match` flag (uses "match" instead of "exact_match")
- Ensure you're using the same compiler version and settings as when the contract was deployed
- Check if the contract was deployed with constructor parameters

### VeChainStats

- It could take up to 24h for VeChainStats to replicate the verification from Sourcify into their database.
