# Analyze Proposal Deposits Script

## ⚠️ DISCLAIMER

This script is essential for identifying users who haven't withdrawn their tokens from governance proposals, which causes the withdraw function to panic in the current contract version.

### Background Issue

With the introduction of **B3TRGovernor V7**, we implemented a new `depositVotingPower` concept to track voting power associated with deposits. However, during the contract upgrade, we **did not seed the historical deposit voting power data** for existing deposits made prior to V7.

This creates a critical issue:

- **Problem**: When users attempt to withdraw their old claimable tokens, the withdraw function tries to decrement their `depositVotingPower`
- **Panic Scenario**: If a user has 10 tokens to withdraw, the contract attempts: `0 - 10 = -10` (underflow)
- **Root Cause**: The `depositVotingPower` storage was initialized as `0` for all historical deposits, but the withdrawal logic assumes this value was properly tracked from the beginning

### Why This Script Exists

Since the backwards compatibility for `depositVotingPower` was not properly seeded during the V7 upgrade, we need to:

1. **Identify** all users with stuck/unwithdrawable deposits
2. **Quantify** the total amount of tokens affected
3. **Prepare data** for either a contract fix or manual intervention

## 🔍 What This Script Does

The `analyzeProposalDeposits.ts` script performs a comprehensive analysis to identify stuck deposits:

### 1. **Event Collection**

- Fetches all `ProposalCreated` events since contract deployment to get all proposal IDs
- Fetches all `ProposalDeposit` events to identify all users who have made deposits

### 2. **Deposit Analysis**

- For each unique depositor address found in the deposit events
- Checks against every proposal ID using the `getUserDeposit()` contract function
- Identifies any remaining unclaimed/unwithdrawable tokens

### 3. **Data Processing**

- Processes events in chunks to handle large datasets efficiently
- Uses parallel processing with batching to optimize performance
- Prevents memory overflow with configurable batch sizes

### 4. **Results Export**

- Stores all stuck deposits in memory during execution
- Exports final results to `stuckDeposits.json` with detailed information:
  ```json
  [
    {
      "walletAddress": "0x123...",
      "proposalId": "42",
      "depositAmount": "1000000000000000000000"
    }
  ]
  ```

## 🚀 Usage

### Running the Script

Execute the analysis on mainnet:

```bash
yarn contracts:analyze-proposal-deposits:mainnet
```

### Expected Output

The script provides detailed logging during execution:

```
================================================================================
🔍 B3TR GOVERNANCE STUCK DEPOSITS ANALYSIS
================================================================================
🔗 Network: mainnet
📋 Environment: production
🏛️ Governor Address: 0x...
📊 Block Range: 18,868,871 → 21,234,567
📈 Total Blocks to Analyze: 2,365,696
================================================================================

📊 Step 1: Fetching blockchain events...
✅ Deposit Events Found: 1,234
✅ Proposal Created Events Found: 56

📊 Step 2: Processing and organizing events by depositor...
👥 Found 789 unique depositors
📋 Found 56 total proposals

🔍 Step 3: Analyzing stuck deposits with batched parallel processing...
🚀 Processing 44,184 deposit checks in batches...

================================================================================
📊 STUCK DEPOSITS ANALYSIS SUMMARY
================================================================================
💰 Total Stuck Amount: 12,345.6789 B3TR
📈 Total Stuck Deposits: 127
👥 Affected Wallets: 89
📋 Affected Proposals: 23
================================================================================
```

### Output Files

- **`stuckDeposits.json`**: Complete list of all stuck deposits with wallet addresses, proposal IDs, and amounts

## 📊 Performance Characteristics

- **Block Range**: Analyzes from contract deployment block (18,868,871) to current block
- **Chunk Processing**: Uses 100,000 block chunks for event fetching
- **Batch Processing**: Processes deposit checks in batches of 500 to prevent memory issues
- **Parallel Execution**: Maximizes efficiency with concurrent contract calls

## 🔧 Technical Details

### Key Functions

- **`fetchEventsInChunks()`**: Retrieves blockchain events in manageable chunks
- **`checkDepositStuckInChunks()`**: Processes deposit checks in parallel batches
- **`getUserDeposit()`**: Calls the contract to check for unclaimed tokens
- **`calculateStuckDepositsSummary()`**: Generates comprehensive analysis summary

### Memory Optimization

The script includes several optimizations to handle large datasets:

- Chunked event fetching to prevent RPC timeouts
- Batched parallel processing to avoid memory overflow
- Progress tracking for long-running operations

## 🎯 Next Steps

After running this analysis:

1. **Review Results**: Examine `stuckDeposits.json` to understand the scope of affected users
2. **Contract Fix**: Use the data to implement a proper seeding mechanism for `depositVotingPower`
3. **User Communication**: Notify affected users about the issue and resolution timeline
4. **Testing**: Verify the fix works for all identified stuck deposits

## 📝 Notes

- The script is read-only and does not modify blockchain state
- Runtime can be significant due to the comprehensive nature of the analysis
- Results are deterministic and can be re-run for verification
- All amounts are stored in wei (18 decimal places)
