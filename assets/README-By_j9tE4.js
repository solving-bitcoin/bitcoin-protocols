const e=`# CHECKSIGFROMSTACK and deleted-key recursion

This folder adds OP_CHECKSIGFROMSTACK (CSFS) and a deleted-key setup assumption
to the parent folder's OP_TEMPLATEHASH requirement. See Sections 4.2 and 6 of
the [BitVM-448 paper](https://robinlinus.com/bitvm448.pdf).

A setup key signs the template hash for the recursive output template. The
covenant uses CSFS to check the setup signature against the TH value. The key
must then be destroyed; in the proposed N-of-N ceremony, at least one
participant must honestly delete its secret share. Setup is per prepared slot
or safely reusable exact template class, not universal authorization for future
amounts and scripts.

The [graph](bitvm448-deleted-key.md) unrolls a few instances of an indefinitely
recurring template. Cancellation recreates the same reserve script and amount;
it does not remove the operator's leaf. Once its global slashing secret is
public, subsequent assertions by that operator can be cancelled immediately,
each consuming a new bond as fees. A separate B branch illustrates continued
use by another operator. Other operators and later repetitions are omitted.

This is still an optimistic BitVM3 bridge. CSFS verifies a signature over a
template hash; it does not verify the claimed ZK proof. The parent README's
slot, assertion-artifact, challenge-window, and value-accounting requirements
continue to apply.
`;export{e as default};
