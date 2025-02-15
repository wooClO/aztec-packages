import { type ForeignCallOutput, Noir } from '@noir-lang/noir_js';
import createDebug from 'debug';
import { ungzip } from 'pako';
import { type Page } from 'playwright';

import MockAppCreatorCircuit from '../artifacts/app_creator.json' assert { type: 'json' };
import MockAppReaderCircuit from '../artifacts/app_reader.json' assert { type: 'json' };
import MockPrivateKernelInitCircuit from '../artifacts/mock_private_kernel_init.json' assert { type: 'json' };
import MockPrivateKernelInnerCircuit from '../artifacts/mock_private_kernel_inner.json' assert { type: 'json' };
import MockPrivateKernelResetCircuit from '../artifacts/mock_private_kernel_reset.json' assert { type: 'json' };
import MockPrivateKernelTailCircuit from '../artifacts/mock_private_kernel_tail.json' assert { type: 'json' };
import MockPublicKernelCircuit from '../artifacts/mock_public_kernel.json' assert { type: 'json' };
import type {
  AppCreatorInputType,
  AppPublicInputs,
  AppReaderInputType,
  KernelPublicInputs,
  MockPrivateKernelInitInputType,
  MockPrivateKernelInnerInputType,
  MockPrivateKernelResetInputType,
  MockPrivateKernelTailInputType,
  MockPublicKernelInputType,
  PrivateKernelPublicInputs,
  u8,
} from './types/index.js';

// Re export the circuit jsons
export {
  MockAppCreatorCircuit,
  MockAppReaderCircuit,
  MockPrivateKernelInitCircuit,
  MockPrivateKernelInnerCircuit,
  MockPrivateKernelResetCircuit,
  MockPrivateKernelTailCircuit,
  MockPublicKernelCircuit,
};

createDebug.enable('*');
const logger = createDebug('aztec:ivc-test');

/* eslint-disable camelcase */

export const MOCK_MAX_COMMITMENTS_PER_TX = 4;

function foreignCallHandler(): Promise<ForeignCallOutput[]> {
  throw new Error('Unexpected foreign call');
}

export interface WitnessGenResult<PublicInputsType> {
  witness: Uint8Array;
  publicInputs: PublicInputsType;
}

export async function witnessGenCreatorAppMockCircuit(
  args: AppCreatorInputType,
): Promise<WitnessGenResult<AppPublicInputs>> {
  const program = new Noir(MockAppCreatorCircuit);
  const { witness, returnValue } = await program.execute(args, foreignCallHandler);
  return {
    witness,
    publicInputs: returnValue as AppPublicInputs,
  };
}

export async function witnessGenReaderAppMockCircuit(
  args: AppReaderInputType,
): Promise<WitnessGenResult<AppPublicInputs>> {
  const program = new Noir(MockAppReaderCircuit);
  const { witness, returnValue } = await program.execute(args, foreignCallHandler);
  return {
    witness,
    publicInputs: returnValue as AppPublicInputs,
  };
}

export async function witnessGenMockPrivateKernelInitCircuit(
  args: MockPrivateKernelInitInputType,
): Promise<WitnessGenResult<PrivateKernelPublicInputs>> {
  const program = new Noir(MockPrivateKernelInitCircuit);
  const { witness, returnValue } = await program.execute(args, foreignCallHandler);
  return {
    witness,
    publicInputs: returnValue as PrivateKernelPublicInputs,
  };
}

export async function witnessGenMockPrivateKernelInnerCircuit(
  args: MockPrivateKernelInnerInputType,
): Promise<WitnessGenResult<PrivateKernelPublicInputs>> {
  const program = new Noir(MockPrivateKernelInnerCircuit);
  const { witness, returnValue } = await program.execute(args, foreignCallHandler);
  return {
    witness,
    publicInputs: returnValue as PrivateKernelPublicInputs,
  };
}

export async function witnessGenMockPrivateKernelResetCircuit(
  args: MockPrivateKernelResetInputType,
): Promise<WitnessGenResult<PrivateKernelPublicInputs>> {
  const program = new Noir(MockPrivateKernelResetCircuit);
  const { witness, returnValue } = await program.execute(args, foreignCallHandler);
  return {
    witness,
    publicInputs: returnValue as PrivateKernelPublicInputs,
  };
}

export async function witnessGenMockPrivateKernelTailCircuit(
  args: MockPrivateKernelTailInputType,
): Promise<WitnessGenResult<KernelPublicInputs>> {
  const program = new Noir(MockPrivateKernelTailCircuit);
  const { witness, returnValue } = await program.execute(args, foreignCallHandler);
  return {
    witness,
    publicInputs: returnValue as KernelPublicInputs,
  };
}

export async function witnessGenMockPublicKernelCircuit(
  args: MockPublicKernelInputType,
): Promise<WitnessGenResult<u8>> {
  const program = new Noir(MockPublicKernelCircuit);
  const { witness, returnValue } = await program.execute(args, foreignCallHandler);
  return {
    witness,
    publicInputs: returnValue as u8,
  };
}

export async function generate3FunctionTestingIVCStack(): Promise<[string[], Uint8Array[]]> {
  const tx = {
    number_of_calls: '0x1',
  };

  // Witness gen app and kernels
  const appWitnessGenResult = await witnessGenCreatorAppMockCircuit({ commitments_to_create: ['0x1', '0x2'] });
  logger('generated app mock circuit witness');

  const initWitnessGenResult = await witnessGenMockPrivateKernelInitCircuit({
    app_inputs: appWitnessGenResult.publicInputs,
    tx,
  });
  logger('generated mock private kernel init witness');

  const tailWitnessGenResult = await witnessGenMockPrivateKernelTailCircuit({
    prev_kernel_public_inputs: initWitnessGenResult.publicInputs,
  });
  logger('generated mock private kernel tail witness');

  // Create client IVC proof
  const bytecodes = [
    MockAppCreatorCircuit.bytecode,
    MockPrivateKernelInitCircuit.bytecode,
    MockPrivateKernelTailCircuit.bytecode,
  ];
  const witnessStack = [appWitnessGenResult.witness, initWitnessGenResult.witness, tailWitnessGenResult.witness];

  return [bytecodes, witnessStack];
}

export async function generate6FunctionTestingIVCStack(): Promise<[string[], Uint8Array[]]> {
  const tx = {
    number_of_calls: '0x2',
  };
  // Witness gen app and kernels
  const creatorAppWitnessGenResult = await witnessGenCreatorAppMockCircuit({ commitments_to_create: ['0x1', '0x2'] });
  const readerAppWitnessGenResult = await witnessGenReaderAppMockCircuit({ commitments_to_read: ['0x2', '0x0'] });

  const initWitnessGenResult = await witnessGenMockPrivateKernelInitCircuit({
    app_inputs: creatorAppWitnessGenResult.publicInputs,
    tx,
  });
  const innerWitnessGenResult = await witnessGenMockPrivateKernelInnerCircuit({
    prev_kernel_public_inputs: initWitnessGenResult.publicInputs,
    app_inputs: readerAppWitnessGenResult.publicInputs,
  });

  const resetWitnessGenResult = await witnessGenMockPrivateKernelResetCircuit({
    prev_kernel_public_inputs: innerWitnessGenResult.publicInputs,
    commitment_read_hints: [
      '0x1', // Reader reads commitment 0x2, which is at index 1 of the created commitments
      MOCK_MAX_COMMITMENTS_PER_TX.toString(), // Pad with no-ops
      MOCK_MAX_COMMITMENTS_PER_TX.toString(),
      MOCK_MAX_COMMITMENTS_PER_TX.toString(),
    ],
  });

  const tailWitnessGenResult = await witnessGenMockPrivateKernelTailCircuit({
    prev_kernel_public_inputs: resetWitnessGenResult.publicInputs,
  });

  // Create client IVC proof
  const bytecodes = [
    MockAppCreatorCircuit.bytecode,
    MockPrivateKernelInitCircuit.bytecode,
    MockAppReaderCircuit.bytecode,
    MockPrivateKernelInnerCircuit.bytecode,
    MockPrivateKernelResetCircuit.bytecode,
    MockPrivateKernelTailCircuit.bytecode,
  ];
  const witnessStack = [
    creatorAppWitnessGenResult.witness,
    initWitnessGenResult.witness,
    readerAppWitnessGenResult.witness,
    innerWitnessGenResult.witness,
    resetWitnessGenResult.witness,
    tailWitnessGenResult.witness,
  ];

  return [bytecodes, witnessStack];
}

function base64ToUint8Array(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

export async function proveAndVerifyBrowser(bytecodes: string[], witnessStack: Uint8Array[], threads?: number) {
  const { AztecClientBackend } = await import('@aztec/bb.js');
  const preparedBytecodes = bytecodes.map(base64ToUint8Array).map((arr: Uint8Array) => ungzip(arr));
  const backend = new AztecClientBackend(preparedBytecodes, { threads });
  const verified = await backend.proveAndVerify(witnessStack.map((arr: Uint8Array) => ungzip(arr)));

  await backend.destroy();
  return verified;
}

export async function proveAndVerifyAztecClient(
  page: Page,
  bytecodes: string[],
  witnessStack: Uint8Array[],
): Promise<boolean> {
  const threads = 16;

  const result: boolean = await page.evaluate(
    ([acir, witness, numThreads]) => {
      (window as any).proveAndVerifyBrowser = proveAndVerifyBrowser;
      return (window as any).proveAndVerifyBrowser(acir, witness, numThreads);
    },
    [bytecodes, witnessStack, threads],
  );

  return result;
}
