# PoW work-limited Bitcoin light client and bridge

Users lock BTC in a Bitcoin reserve and receive wrapped BTC on an L2 whose data is published on Bitcoin. Operators prepare a fixed pool of BitVM3 instances in advance; each deposit presigns reimbursement paths to those instances. An operator fronts the user's Bitcoin payout and proves the corresponding L2 burn, matching payout, and sufficient subsequent Bitcoin proof of work. Each burn receives its own consecutive block range; neither a block's work credit nor a burn's reimbursement authorization may be reused.

BitVM3 enforces the proof optimistically. Assert exposes the encoded proof to challengers and creates a reimbursement connector. A successful Disprove consumes that connector. Otherwise, after a relative timelock, Reimburse spends the surviving connector together with the presigned reserve output and pays the operator.

The light client checks a supplied history and its work. It does **not establish that the history is canonical**. The design instead relates withdrawal value to the expected public-mining revenue associated with that work. At safety factor `s = 1`, this is a break-even benchmark, not a proof of economic deterrence or bridge safety.

## Actors

| Actor | Role |
| --- | --- |
| User | Deposits BTC, receives wrapped BTC, and requests a withdrawal back to Bitcoin. |
| N-of-N signers | Verify the prepared BitVM3 instances and presign each deposit's permitted reimbursements, then delete the deposit signing keys. |
| Operator / prover | Prepares BitVM3 instances, fronts withdrawals, proves the burn, payout, allocation, and work, and claims reimbursement after the timelock. |
| Challenger | Monitors Assert transactions, evaluates their BitVM3 proofs, and disproves invalid claims before reimbursement. |
| L2 participants | Execute the L2 rules and publish its transaction data on Bitcoin. |
| Bitcoin miners | Produce the blocks supplying work credit and include reserve funding and payout transactions. |

Deposit authorization is modeled with an N-of-N committee. Challenging is permissionless; the committee does not need to sign again at withdrawal time.

## Protocol phases

| Phase | Protocol action |
| --- | --- |
| Setup | Fix the L2, allocation, and work-verification rules. Each operator pregenerates a fixed pool of BitVM3 instances with verified garbling, proof-encoding commitments, and Assert / Disprove / Reimburse templates. |
| Deposit | All N signers presign the deposit's Reimburse alternatives for the prepared operator instances and delete the deposit signing keys. Lock BTC in the reserve and mint the corresponding wrapped BTC on the L2. |
| Burn and allocation | Publish the valid burn. Assign it the next `n(V) = ceil(V / r)` eligible consecutive blocks, starting after both its publication block and the last block allocated to earlier requests. |
| Payout and assertion | The operator fronts the user's payout. Once the assigned work is available, it posts Assert proving the valid burn history, allocation, work, and matching Bitcoin payout, bound to the deposit and claim instance. |
| Dispute or reimbursement | A challenger can consume Assert's connector with a BitVM3 disproof. If it remains unspent after `Delta`, the operator combines it with the presigned deposit input to receive reimbursement. |

## Protocol parameters

| Parameter | Meaning |
| --- | --- |
| `N`, `M` | Number of deposit signers and prepared operators. |
| `K` | Fixed number of pregenerated BitVM3 claim instances per operator; setup does not grow with the number of deposits. |
| `Delta` | Relative timelock from Assert confirmation to operator reimbursement, allowing time for disproof. |
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
| BitVM3 enforcement | Correct verified garbling and proof encoding; at least **1 of N signers** authorizes only the permitted reimbursement transactions and deletes its signing key; at least **one honest challenger** can detect and confirm disproofs within `Delta`. This enforces the proof relation, not canonicality. |
| Claim binding | The proof binds the burn, amount, recipient, matching Bitcoin payout, deposit, and operator instance. The allocation and claim rules must reject reused work and duplicate reimbursement across instances. |
| Economic protection | Required work has an expected public-mining revenue benchmark of at least `V`. At `s = 1`, this does not establish a strictly unprofitable attack or a deterministic attacker expense. No safe attacker-hashrate threshold is derived. |
| Deposit liveness | **All N signers** must be available to presign the deposit's reimbursements. Bitcoin includes the deposit and the L2 processes the backed mint. |
| Withdrawal liveness | At least **1 of M operators** has payout liquidity and an unused instance authorized for the deposit. L2 data is available, eligible blocks accumulate, proofs can be generated, and Bitcoin includes the payout and subsequent reimbursement. |

The reserve signature commits to the selected Assert outpoint and reimbursement outputs. Assert's transaction ID must be fixed before deposit presigning; future proof data is supplied through the prepared BitVM3 witness encoding. Disprove and Reimburse conflict on the same Assert output, so a confirmed disproof disables that reimbursement path without spending the reserve.

### PoW light-client checks

The proof must establish a linked Bitcoin header history satisfying the model's fixed PoW target, the burn's publication in that history, and valid L2 execution through the burn. It must also cover every eligible earlier withdrawal request, including unpaid ones: omitting a request must not free its assigned blocks for reuse.

For a burn published at height `h_b` and the last block assigned to earlier requests at `h_prev`, its range begins at `max(h_b, h_prev) + 1` and contains `n(V)` consecutive blocks. Its work credit is `n(V) × D`, valued at `n(V) × D × (r / D) = n(V) × r >= V`. The block-count and work conditions coincide when difficulty equals the setup forecast.

An attacker could supply a valid private history containing a burn absent from the public L2 history, seek public-chain reserve reimbursement, and retain the public wrapped balance. Header validity, a SNARK, and sufficient nominal work do not by themselves rule out that attack. BitVM3 rejects false proofs; it does not reject a valid proof of a private history merely because that history is not canonical. Checkpoint anchoring and allocation and claim uniqueness across competing histories still need precise rules.

## Off-chain resources

| Phase | Resources |
| --- | --- |
| Setup | `M × K` pregenerated BitVM3 instances, including verified garbling, proof-encoding artifacts, and claim templates. This fixed setup is shared across deposits. |
| Deposit | If every deposit is authorized for every prepared instance, `N × M × K` reimbursement presignatures per deposit across all signers; `M × K` per signer. |
| Withdrawal | L2 execution and publication data, the matching Bitcoin payout, header history, prior-request allocations, and a proof encoded into one prepared instance. Challengers evaluate the published artifacts. |

Presigning another deposit adds reimbursement alternatives, not another set of BitVM3 instances. One-time claim connectors are still consumed when used; sharing the setup across deposits does not make an instance reusable. Proof sizes and prover costs depend on the concrete circuit and encoding.

## Throughput and capacity

All withdrawals share the block budget. With continuous demand, no rounding waste, and no other bottlenecks, capacity is **`C = lambda × r` BTC/day**. For equal-sized withdrawals, **`C_V = lambda × V / ceil(V / r)`**. Adding operators does not multiply capacity because different burns cannot reuse the same blocks.

With no queue or other delays, expected work-accumulation latency after burn publication is **`L(V) = ceil(V / r) / lambda` days**. Using illustrative values of `lambda = 144` blocks/day and `r = 3.125` BTC/block:

| Withdrawal size | Assigned blocks | Expected work wait | Sustained capacity at that size |
| --- | --- | --- | --- |
| 3.125 BTC | 1 | 10 minutes | 450 BTC/day |
| 10 BTC | 4 | 40 minutes | 360 BTC/day |

These are model examples, not current-network measurements or guaranteed completion times. The user receives BTC when the operator-funded payout confirms. Operator reimbursement additionally waits for the assigned work, proof generation, Assert confirmation, and `Delta`; fronting liquidity can therefore remain tied up after the user is paid. Pending withdrawals consume their allocated work even before reimbursement.

The graph models one deposit reimbursement per claim instance. The prepared pool therefore supplies up to `M × K` claim slots, reduced by used or disproven instances. This is a separate limit from the shared PoW budget. More operators can add liquidity and slots, but cannot multiply the work-backed BTC/day rate.

## Caveats and open questions

- **Finite prepared capacity.** Exhausted or disproven instances cannot be reused. Continuing service needs fresh instances and reserve authorizations; migration of existing deposits and recovery paths must be specified.
- **Concrete parameters.** BitVM3 supplies enforcement under current Bitcoin consensus without a native SNARK-verification opcode. The circuit, encoding, transaction sizes, funding and fees, and `Delta` still need concrete values and relay-policy checks.
- **Constant difficulty and subsidy are model assumptions.** A deployment must define difficulty-retarget and halving behavior, work valuation, and anchoring. Fees are excluded from the economic benchmark, though Bitcoin transactions still need fees.
- **Work value is not net attack cost.** Mining luck, the attacker's strategy and hashrate, and recoverable block rewards matter. A replacement chain that becomes canonical may pay the attacker its subsidies.
- **The capacity bound is specific to this rule.** The heuristic `C <= lambda × r` assumes burns can be rewritten while payouts survive. A separate ideal construction binds each payout to a unique burn ticket in an ordered Bitcoin update-transaction ancestry. Removing the burn then removes the ticket needed by the payout; retaining both preserves backing. That construction can exceed the subsidy-based capacity bound, but its proof-enforced dependency is a separate implementation question, not a property of this work-limited graph.

## Graph scope

The graph shows one 10 BTC deposit and one representative BitVM3 instance, repeated across the fixed operator pools. The operator fronts 10 BTC separately from the reserve. Instance funding is symbolic (`*`); fees and detailed BitVM3 encoding transactions are omitted. Burn data, headers, and the payout enter the proof, not Bitcoin input edges into Assert. No burn-ticket ancestry or deposit refund is assumed.

```bridgeflow
color_groups:
  nofn_presignature: blue
```

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
          N-of-N presigned Reimburse
          Bound to prepared Assert outpoint
```

After reserve funding, the L2 credits the corresponding wrapped BTC. Minting is an L2 transition and is not a Bitcoin transaction in this graph.

## tx: payout

```bridgeflow
label: Payout
inputs:
  - label: 10 BTC operator payout-wallet funds
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: recipient
        label: withdrawal recipient
```

The operator pays the user before receiving reserve reimbursement. Its claim proof must verify this payout matches the burn's recipient and amount.

## tx: assert_funding

```bridgeflow
label: Prepared BitVM3 instance
inputs:
  - label: operator instance funding
outputs:
  - amount: "*"
    spending_paths:
      - id: proof_encoding
        label: |-
          Mandatory BitVM3 proof encoding
          Prepared garbled verifier
```

## tx: assert_tx

```bridgeflow
label: Assert
inputs:
  - tx: assert_funding
    output: 0
    spending_path: proof_encoding
    label: |-
      Valid burn + matching payout
      Assigned work + no reuse
      Bound to deposit and instance
outputs:
  - amount: "*"
    label: Reimbursement connector
    spending_paths:
      - id: disprove
        label: challenger with BitVM3 false-output label
      - id: operator_timeout
        label: operator + CSV(Delta)
```

The four-block work condition for a 10 BTC burn at `r = 3.125` is proved against the supplied history. It is separate from Assert's reimbursement timelock and does not establish canonicality.

## tx: disprove

```bridgeflow
label: Disprove
inputs:
  - tx: assert_tx
    output: 0
    spending_path: disprove
    arrow_label: invalid proof
outputs: []
```

Disprove consumes the reimbursement connector and leaves the reserve untouched. Disproof fee and reward outputs are omitted.

## tx: reimburse

```bridgeflow
label: Reimburse
inputs:
  - tx: deposit
    output: 0
    spending_path: work_limited_payout
    sighash_flag: sighash_all
    color: nofn_presignature
  - tx: assert_tx
    output: 0
    spending_path: operator_timeout
    arrow_label: Delta after Assert
outputs:
  - amount: "10.00000000"
    label: Operator reimbursement
    spending_paths:
      - id: operator
        label: operator
```

Reimburse requires both the reserve and the surviving claim connector. Its deposit-input signature is supplied at deposit time; the operator completes the timelocked input after `Delta`. Instance-funding change and fees are omitted.
