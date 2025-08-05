# Smart Contract Tests

Each test describe block is marked with a shard name. This is needed to split large test suites into smaller, parallel runs for faster CI execution and to prevent timeouts.

## Active Shards

The following shards are currently active:

```
shard0  shard2  shard3a shard3b  shard4  shard5  shard6  shard7  shard8
shard8a shard8b shard8c shard9  shard10 shard11 shard12 shard13
shard14 shard15 shard16 shard17
```

When adding new tests, assign them to an appropriate shard to maintain balanced execution times across all shards.
