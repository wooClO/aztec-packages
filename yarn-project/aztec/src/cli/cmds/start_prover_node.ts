import { ProverNodeApiSchema, ProvingJobSourceSchema, createAztecNodeClient } from '@aztec/circuit-types';
import { NULL_KEY } from '@aztec/ethereum';
import { type NamespacedApiHandlers } from '@aztec/foundation/json-rpc/server';
import { type LogFn } from '@aztec/foundation/log';
import {
  type ProverNodeConfig,
  createProverNode,
  getProverNodeConfigFromEnv,
  proverNodeConfigMappings,
} from '@aztec/prover-node';
import { createAndStartTelemetryClient, telemetryClientConfigMappings } from '@aztec/telemetry-client/start';

import { mnemonicToAccount } from 'viem/accounts';

import { extractRelevantOptions } from '../util.js';

export async function startProverNode(
  options: any,
  signalHandlers: (() => Promise<void>)[],
  services: NamespacedApiHandlers,
  userLog: LogFn,
) {
  if (options.node || options.sequencer || options.pxe || options.p2pBootstrap || options.txe) {
    userLog(`Starting a prover-node with --node, --sequencer, --pxe, --p2p-bootstrap, or --txe is not supported.`);
    process.exit(1);
  }

  const proverConfig = {
    ...getProverNodeConfigFromEnv(), // get default config from env
    ...extractRelevantOptions<ProverNodeConfig>(options, proverNodeConfigMappings, 'proverNode'), // override with command line options
  };

  if (!options.archiver && !proverConfig.archiverUrl) {
    userLog('--archiver.archiverUrl is required to start a Prover Node without --archiver option');
    process.exit(1);
  }

  if (options.prover || options.proverAgentEnabled) {
    userLog(`Running prover node with local prover agent.`);
    proverConfig.proverAgentEnabled = true;
  } else {
    userLog(`Running prover node without local prover agent. Connect one or more prover agents to this node.`);
    proverConfig.proverAgentEnabled = false;
  }

  if (!proverConfig.publisherPrivateKey || proverConfig.publisherPrivateKey === NULL_KEY) {
    if (!options.l1Mnemonic) {
      userLog(`--l1-mnemonic is required to start a Prover Node without --node.publisherPrivateKey`);
      process.exit(1);
    }
    const hdAccount = mnemonicToAccount(options.l1Mnemonic);
    const privKey = hdAccount.getHdKey().privateKey;
    proverConfig.publisherPrivateKey = `0x${Buffer.from(privKey!).toString('hex')}`;
  }

  // TODO(palla/prover-node) L1 contract addresses should not silently default to zero,
  // they should be undefined if not set and fail loudly.
  // Load l1 contract addresses from aztec node if not set.
  const isRollupAddressSet =
    proverConfig.l1Contracts?.rollupAddress && !proverConfig.l1Contracts.rollupAddress.isZero();
  const nodeUrl = proverConfig.nodeUrl ?? proverConfig.proverCoordinationNodeUrl;
  if (nodeUrl && !isRollupAddressSet) {
    userLog(`Loading L1 contract addresses from aztec node at ${nodeUrl}`);
    proverConfig.l1Contracts = await createAztecNodeClient(nodeUrl).getL1ContractAddresses();
  }

  const telemetry = await createAndStartTelemetryClient(
    extractRelevantOptions(options, telemetryClientConfigMappings, 'tel'),
  );
  const proverNode = await createProverNode(proverConfig, { telemetry });

  services.proverNode = [proverNode, ProverNodeApiSchema];

  if (!options.prover) {
    services.provingJobSource = [proverNode.getProver().getProvingJobSource(), ProvingJobSourceSchema];
  }

  signalHandlers.push(proverNode.stop.bind(proverNode));

  // Automatically start proving unproven blocks
  await proverNode.start();
}
