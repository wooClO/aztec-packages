import { bufferAsFields } from '@aztec/foundation/abi';
import { poseidon2Hash, poseidon2HashWithSeparator } from '@aztec/foundation/crypto';
import { Fr } from '@aztec/foundation/fields';

import { strict as assert } from 'assert';

import { GeneratorIndex, MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS } from '../constants.gen.js';
import { type ContractClass } from './interfaces/contract_class.js';
import { computePrivateFunctionsRoot } from './private_function.js';

/**
 * Returns the id of a contract class computed as its hash.
 *
 * ```
 * version = 1
 * private_function_leaves = private_functions.map(fn => pedersen([fn.function_selector as Field, fn.vk_hash], GENERATOR__FUNCTION_LEAF))
 * private_functions_root = merkleize(private_function_leaves)
 * bytecode_commitment = calculate_commitment(packed_bytecode)
 * contract_class_id = pedersen([version, artifact_hash, private_functions_root, bytecode_commitment], GENERATOR__CLASS_IDENTIFIER)
 * ```
 * @param contractClass - Contract class.
 * @returns The identifier.
 */
export function computeContractClassId(contractClass: ContractClass | ContractClassIdPreimage): Fr {
  return computeContractClassIdWithPreimage(contractClass).id;
}

/** Computes a contract class id and returns it along with its preimage. */
export function computeContractClassIdWithPreimage(
  contractClass: ContractClass | ContractClassIdPreimage,
): ContractClassIdPreimage & { id: Fr } {
  const artifactHash = contractClass.artifactHash;
  const privateFunctionsRoot =
    'privateFunctionsRoot' in contractClass
      ? contractClass.privateFunctionsRoot
      : computePrivateFunctionsRoot(contractClass.privateFunctions);
  const publicBytecodeCommitment =
    'publicBytecodeCommitment' in contractClass
      ? contractClass.publicBytecodeCommitment
      : computePublicBytecodeCommitment(contractClass.packedBytecode);
  const id = poseidon2HashWithSeparator(
    [artifactHash, privateFunctionsRoot, publicBytecodeCommitment],
    GeneratorIndex.CONTRACT_LEAF, // TODO(@spalladino): Review all generator indices in this file
  );
  return { id, artifactHash, privateFunctionsRoot, publicBytecodeCommitment };
}

/** Returns the preimage of a contract class id given a contract class. */
export function computeContractClassIdPreimage(contractClass: ContractClass): ContractClassIdPreimage {
  const privateFunctionsRoot = computePrivateFunctionsRoot(contractClass.privateFunctions);
  const publicBytecodeCommitment = computePublicBytecodeCommitment(contractClass.packedBytecode);
  return { artifactHash: contractClass.artifactHash, privateFunctionsRoot, publicBytecodeCommitment };
}

/** Preimage of a contract class id. */
export type ContractClassIdPreimage = {
  artifactHash: Fr;
  privateFunctionsRoot: Fr;
  publicBytecodeCommitment: Fr;
};

export function computePublicBytecodeCommitment(packedBytecode: Buffer) {
  // Encode the buffer into field elements (chunked into 32 bytes each)
  const encodedBytecode: Fr[] = bufferAsFields(packedBytecode, MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS);
  // The first element is the length of the bytecode (in bytes)
  const bytecodeLength = Math.ceil(encodedBytecode[0].toNumber() / (Fr.SIZE_IN_BYTES - 1));
  assert(bytecodeLength < MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS, 'Bytecode exceeds maximum deployable size');

  let bytecodeCommitment = new Fr(0);
  for (let i = 0; i < bytecodeLength; i++) {
    // We skip the first element, which is the length of the bytecode
    bytecodeCommitment = poseidon2Hash([encodedBytecode[i + 1], bytecodeCommitment]);
  }
  return bytecodeCommitment;
}
