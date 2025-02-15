import { Archiver, type ArchiverConfig, KVArchiverDataStore, archiverConfigMappings } from '@aztec/archiver';
import { createDebugLogger } from '@aztec/aztec.js';
import { ArchiverApiSchema } from '@aztec/circuit-types';
import { type NamespacedApiHandlers } from '@aztec/foundation/json-rpc/server';
import { createStore } from '@aztec/kv-store/utils';
import {
  createAndStartTelemetryClient,
  getConfigEnvVars as getTelemetryClientConfig,
} from '@aztec/telemetry-client/start';

import { extractRelevantOptions } from '../util.js';

/** Starts a standalone archiver. */
export async function startArchiver(
  options: any,
  signalHandlers: (() => Promise<void>)[],
  services: NamespacedApiHandlers,
) {
  const archiverConfig = extractRelevantOptions<ArchiverConfig>(options, archiverConfigMappings, 'archiver');

  const storeLog = createDebugLogger('aztec:archiver:lmdb');
  const store = await createStore('archiver', archiverConfig, storeLog);
  const archiverStore = new KVArchiverDataStore(store, archiverConfig.maxLogs);

  const telemetry = await createAndStartTelemetryClient(getTelemetryClientConfig());
  const archiver = await Archiver.createAndSync(archiverConfig, archiverStore, telemetry, true);
  services.archiver = [archiver, ArchiverApiSchema];
  signalHandlers.push(archiver.stop);
  return services;
}
