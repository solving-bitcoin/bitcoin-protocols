# PoW work-limited Bitcoin light client and bridge

Users lock BTC in a Bitcoin reserve and receive wrapped BTC on an L2 whose data is published on Bitcoin. To withdraw `V` BTC, an operator burns `V` wrapped BTC and proves valid L2 execution together with enough subsequent Bitcoin proof of work. Each burn receives its own consecutive block range; neither a block's work credit nor a burn's payout authorization may be reused.

The light client checks a supplied history and its work. It does **not establish that the history is canonical**. The design instead relates withdrawal value to the expected public-mining revenue associated with that work. At safety factor `s = 1`, this is a break-even benchmark, not a proof of economic deterrence or bridge safety.

## Actors

| Actor | Role |
| --- | --- |
| User | Deposits BTC, receives wrapped BTC, and requests a withdrawal back to Bitcoin. |
| Operator / prover | Burns wrapped BTC for the withdrawal and supplies a proof of valid L2 execution, deterministic block allocation, and the required work. |
| L2 participants | Execute the L2 rules and publish its transaction data on Bitcoin. |
| Bitcoin miners | Produce the blocks supplying work credit and include reserve funding and payout transactions. |

A signer committee, challenger set, and their thresholds are unspecified. Those roles depend on how the proof and reserve-spending rules are enforced on Bitcoin.

## Protocol phases

| Phase | Protocol action |
| --- | --- |
| Setup | Fix the L2 validity and withdrawal-allocation rules, constant-difficulty work valuation, and proof relation. The concrete verifier and reserve authorization setup are unspecified. |
| Deposit | Lock BTC in the reserve and mint the corresponding wrapped BTC on the L2. Deposit scripts and a refund path are unspecified. |
| Burn and allocation | Publish the valid burn. Assign it the next `n(V) = ceil(V / r)` eligible consecutive blocks, starting after both its publication block and the last block allocated to earlier requests. |
| Proof and payout | Prove the valid burn history and assigned blocks, then release the corresponding reserve BTC. Reject reused work credit and duplicate payouts. |

## Protocol parameters

| Parameter | Meaning |
| --- | --- |
| `V` | Withdrawal amount in BTC. |
| `D` | Expected hash trials per Bitcoin block, held constant in this model. Each valid block receives nominal work credit `D`, regardless of realized mining luck. |
| `r` | Constant block subsidy in BTC; transaction fees are excluded from work valuation. |
| `lambda` | Average public-chain block production per day. |
| `s` | Safety factor, fixed at **1** in this model. |
| `n(V)` | Number of assigned blocks: `ceil(V / r)`. Unused credit in the final block is discarded. |

## Trust assumptions

| Property | Assumption or limitation |
| --- | --- |
| Proof validity | The SNARK is sound and its statement correctly enforces L2 execution, burn inclusion, allocation, and work checks. A valid proof can still describe a private history. |
| Reserve safety | Bitcoin must enforce the intended payout conditions, including one payout per burn and no work reuse. A concrete enforcement construction and its setup assumptions remain unspecified. |
| Economic protection | Required work has an expected public-mining revenue benchmark of at least `V`. At `s = 1`, this does not establish a strictly unprofitable attack or a deterministic attacker expense. No safe attacker-hashrate threshold is derived. |
| Deposit liveness | Bitcoin includes the deposit and the L2 processes the backed mint. Any additional signer or setup availability requirements remain unspecified. |
| Withdrawal liveness | L2 data is available, an operator can generate the proof, eligible blocks accumulate, and Bitcoin includes the payout. Queueing and verifier-specific delays are additional. |

### PoW light-client checks

The proof must establish a linked Bitcoin header history satisfying the model's fixed PoW target, the burn's publication in that history, and valid L2 execution through the burn. It must also cover every eligible earlier withdrawal request, including unpaid ones: omitting a request must not free its assigned blocks for reuse.

For a burn published at height `h_b` and the last block assigned to earlier requests at `h_prev`, its range begins at `max(h_b, h_prev) + 1` and contains `n(V)` consecutive blocks. Its work credit is `n(V) × D`, valued at `n(V) × D × (r / D) = n(V) × r >= V`. The block-count and work conditions coincide when difficulty equals the setup forecast.

An attacker could supply a valid private history containing a burn absent from the public L2 history, seek a public-chain reserve payout, and retain the public wrapped balance. Header validity, a SNARK, and sufficient nominal work do not by themselves rule out that attack. Checkpoint anchoring, a fork-choice mechanism, and allocation and payout uniqueness across competing histories remain unspecified.

## Off-chain resources

| Phase | Resources |
| --- | --- |
| Setup | A proof system for the L2 and work-allocation rules, plus an implementation of Bitcoin payout enforcement. Circuit size, setup trust, garbling, and presignature counts are unspecified. |
| Withdrawal | L2 execution and publication data, the relevant header history and assigned blocks, prior-request allocation data, and a proof. Proof size, prover cost, and verification cost are unspecified. |

## Throughput and capacity

All withdrawals share the block budget. With continuous demand, no rounding waste, and no other bottlenecks, capacity is **`C = lambda × r` BTC/day**. For equal-sized withdrawals, **`C_V = lambda × V / ceil(V / r)`**. Adding operators does not multiply capacity because different burns cannot reuse the same blocks.

With no queue or other delays, expected work-accumulation latency after burn publication is **`L(V) = ceil(V / r) / lambda` days**. Using illustrative values of `lambda = 144` blocks/day and `r = 3.125` BTC/block:

| Withdrawal size | Assigned blocks | Expected work wait | Sustained capacity at that size |
| --- | --- | --- | --- |
| 3.125 BTC | 1 | 10 minutes | 450 BTC/day |
| 10 BTC | 4 | 40 minutes | 360 BTC/day |

These are model examples, not current-network measurements or guaranteed completion times. Earlier allocations, proof generation, payout inclusion, and any enforcement delays increase latency. Pending withdrawals consume their allocated work even before payout.

## Caveats and open questions

- **Bitcoin enforcement is unresolved.** A SNARK is not a native Bitcoin spending condition. Scripts, presignatures, dispute paths, timeouts, and recovery transactions remain unspecified. Implementation under current consensus and relay rules remains an open question. The graph below is an abstract reserve flow.
- **Constant difficulty and subsidy are model assumptions.** A deployment must define difficulty-retarget and halving behavior, work valuation, and anchoring. Fees are excluded from the economic benchmark, though Bitcoin transactions still need fees.
- **Work value is not net attack cost.** Mining luck, the attacker's strategy and hashrate, and recoverable block rewards matter. A replacement chain that becomes canonical may pay the attacker its subsidies.
- **The capacity bound is specific to this rule.** The heuristic `C <= lambda × r` assumes burns can be rewritten while payouts survive. A separate ideal construction binds each payout to a unique burn ticket in an ordered Bitcoin update-transaction ancestry. Removing the burn then removes the ticket needed by the payout; retaining both preserves backing. That construction can exceed the subsidy-based capacity bound, but its proof-enforced dependency is a separate implementation question, not a property of this work-limited graph.

## Graph scope

The graph shows one 10 BTC reserve allocation and its payout, with fees omitted. The reserve spending-path label states a **required protocol condition whose Bitcoin enforcement is unspecified**. Burn data, headers, and the SNARK are proof inputs, not extra Bitcoin UTXOs; they appear only in the analysis above. No burn-ticket dependency, operator reimbursement path, or refund is assumed.

## tx: deposit

```bridgeflow
label: Deposit
inputs:
  - label: 10 BTC user funds
outputs:
  - amount: "10.00000000"
    label: Bitcoin reserve
    spending_paths:
      - id: work_limited_payout
        label: |-
          Valid burn + assigned PoW
          No work reuse or duplicate payout
          Bitcoin enforcement unspecified
```

After reserve funding, the L2 credits the corresponding wrapped BTC. Minting is an L2 transition and is not a Bitcoin transaction in this graph.

## tx: payout

```bridgeflow
label: Payout (abstract)
inputs:
  - tx: deposit
    output: 0
    spending_path: work_limited_payout
    arrow_label: "10 BTC burn + 4 assigned blocks at r = 3.125"
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: recipient
        label: withdrawal recipient
```

The four-block condition is proved against the supplied history. It is not a Bitcoin relative timelock and does not establish canonicality.
