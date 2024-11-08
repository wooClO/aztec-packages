import {
  type MerkleTreeReadOperations,
  ProvingRequestType,
  makeProcessedTxFromPrivateOnlyTx,
  makeProcessedTxFromTxWithPublicCalls,
  mockTx,
} from '@aztec/circuit-types';
import {
  AvmCircuitInputs,
  AvmCircuitPublicInputs,
  AvmExecutionHints,
  Fr,
  Gas,
  GasSettings,
  GlobalVariables,
  type Header,
  LogHash,
  MAX_NULLIFIERS_PER_TX,
  MAX_PUBLIC_DATA_UPDATE_REQUESTS_PER_TX,
  PublicCircuitPublicInputs,
  PublicDataWrite,
  RevertCode,
  ScopedLogHash,
  TxConstantData,
} from '@aztec/circuits.js';
import { makeCombinedAccumulatedData, makeGas, makePrivateToPublicAccumulatedData } from '@aztec/circuits.js/testing';
import { makeTuple } from '@aztec/foundation/array';

import { makeHeader } from '../l2_block_code_to_purge.js';

/** Makes a bloated processed tx for testing purposes. */
export function makeBloatedProcessedTx({
  seed = 1,
  header,
  db,
  chainId = Fr.ZERO,
  version = Fr.ZERO,
  gasSettings = GasSettings.default(),
  vkTreeRoot = Fr.ZERO,
  protocolContractTreeRoot = Fr.ZERO,
  globalVariables = GlobalVariables.empty(),
  privateOnly = false,
}: {
  seed?: number;
  header?: Header;
  db?: MerkleTreeReadOperations;
  chainId?: Fr;
  version?: Fr;
  gasSettings?: GasSettings;
  vkTreeRoot?: Fr;
  globalVariables?: GlobalVariables;
  protocolContractTreeRoot?: Fr;
  privateOnly?: boolean;
} = {}) {
  seed *= 0x1000; // Avoid clashing with the previous mock values if seed only increases by 1.

  if (!header) {
    if (db) {
      header = db.getInitialHeader();
    } else {
      header = makeHeader(seed);
    }
  }

  const txConstantData = TxConstantData.empty();
  txConstantData.historicalHeader = header;
  txConstantData.txContext.chainId = chainId;
  txConstantData.txContext.version = version;
  txConstantData.txContext.gasSettings = gasSettings;
  txConstantData.vkTreeRoot = vkTreeRoot;
  txConstantData.protocolContractTreeRoot = protocolContractTreeRoot;

  const tx = !privateOnly
    ? mockTx(seed)
    : mockTx(seed, { numberOfNonRevertiblePublicCallRequests: 0, numberOfRevertiblePublicCallRequests: 0 });
  tx.data.constants = txConstantData;

  if (privateOnly) {
    const data = makeCombinedAccumulatedData(seed + 0x1000);

    // Private-only tx has no public data writes.
    data.publicDataWrites.forEach((_, i) => (data.publicDataWrites[i] = PublicDataWrite.empty()));

    // Make the gasUsed empty so that transaction fee is simply the inclusion fee.
    data.gasUsed = Gas.empty();
    const transactionFee = gasSettings.inclusionFee;

    clearLogs(data);

    tx.data.forRollup!.end = data;

    return makeProcessedTxFromPrivateOnlyTx(
      tx,
      transactionFee,
      undefined /* feePaymentPublicDataWrite */,
      globalVariables,
    );
  } else {
    const revertibleData = makePrivateToPublicAccumulatedData(seed + 0x1000);

    revertibleData.nullifiers[MAX_NULLIFIERS_PER_TX - 1] = Fr.ZERO; // Leave one space for the tx hash nullifier in nonRevertibleAccumulatedData.

    clearLogs(revertibleData);

    tx.data.forPublic!.revertibleAccumulatedData = revertibleData;

    const avmOutput = AvmCircuitPublicInputs.empty();
    avmOutput.globalVariables = globalVariables;
    avmOutput.accumulatedData.noteHashes = revertibleData.noteHashes;
    avmOutput.accumulatedData.nullifiers = revertibleData.nullifiers;
    avmOutput.accumulatedData.l2ToL1Msgs = revertibleData.l2ToL1Msgs;
    avmOutput.accumulatedData.publicDataWrites = makeTuple(
      MAX_PUBLIC_DATA_UPDATE_REQUESTS_PER_TX,
      i => new PublicDataWrite(new Fr(i), new Fr(i + 10)),
      seed + 0x2000,
    );

    const avmCircuitInputs = new AvmCircuitInputs(
      '',
      [],
      PublicCircuitPublicInputs.empty(),
      AvmExecutionHints.empty(),
      avmOutput,
    );

    const gasUsed = {
      totalGas: makeGas(),
      teardownGas: makeGas(),
    };

    return makeProcessedTxFromTxWithPublicCalls(
      tx,
      {
        type: ProvingRequestType.PUBLIC_VM,
        inputs: avmCircuitInputs,
      },
      undefined /* feePaymentPublicDataWrite */,
      gasUsed,
      RevertCode.OK,
      undefined /* revertReason */,
    );
  }
}

// Remove all logs as it's ugly to mock them at the moment and we are going to change it to have the preimages be part of the public inputs soon.
function clearLogs(data: {
  noteEncryptedLogsHashes: LogHash[];
  encryptedLogsHashes: ScopedLogHash[];
  unencryptedLogsHashes: ScopedLogHash[];
}) {
  data.noteEncryptedLogsHashes.forEach((_, i) => (data.noteEncryptedLogsHashes[i] = LogHash.empty()));
  data.encryptedLogsHashes.forEach((_, i) => (data.encryptedLogsHashes[i] = ScopedLogHash.empty()));
  data.unencryptedLogsHashes.forEach((_, i) => (data.unencryptedLogsHashes[i] = ScopedLogHash.empty()));
}
