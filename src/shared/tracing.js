/**
 * OpenTelemetry Distributed Tracing
 *
 * Initializes the OTel Node.js SDK so every inbound HTTP request, outbound
 * axios call, and Mongoose query is automatically captured as a trace span.
 * Spans are exported via OTLP HTTP to any compatible backend (Jaeger, Grafana
 * Tempo, Honeycomb, Datadog, …).
 *
 * IMPORTANT — call initTracing() as the VERY FIRST statement in each process
 * entry-point (before Express, axios, Mongoose are required), so the SDK can
 * patch Node's built-in http module in time.
 *
 * Activation:
 *   OTEL_ENABLED=true                                  # required
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces  # default
 *
 * Local Jaeger (no config needed):
 *   docker run -p 4318:4318 -p 16686:16686 \
 *     -e COLLECTOR_OTLP_ENABLED=true \
 *     jaegertracing/all-in-one:latest
 *   open http://localhost:16686
 */

'use strict';

let _sdk = null;

/**
 * Boot the OTel SDK for the given service name.
 * No-ops silently when OTEL_ENABLED != 'true' or packages are absent.
 *
 * @param {string} serviceName  — shown in Jaeger / Tempo as the service label
 * @returns {object|null}       — NodeSDK instance, or null if disabled
 */
function initTracing(serviceName) {
  if (process.env.OTEL_ENABLED !== 'true') return null;
  if (_sdk) return _sdk; // already initialised (e.g. shared module re-loaded)

  try {
    const { NodeSDK }            = require('@opentelemetry/sdk-node');
    const { OTLPTraceExporter }  = require('@opentelemetry/exporter-trace-otlp-http');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { Resource }           = require('@opentelemetry/resources');
    const pkg                    = require('../../package.json');

    _sdk = new NodeSDK({
      resource: new Resource({
        'service.name':    serviceName,
        'service.version': pkg.version,
      }),
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // fs spans are extremely noisy (hundreds per request) — disable
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    _sdk.start();
    console.log(`[tracing] OpenTelemetry active — service: ${serviceName}`);

    const shutdown = () =>
      _sdk.shutdown()
        .then(() => console.log('[tracing] SDK shut down cleanly'))
        .catch(err => console.error('[tracing] shutdown error:', err.message));

    process.on('SIGTERM', shutdown);
    process.on('SIGINT',  shutdown);

    return _sdk;
  } catch (err) {
    // Packages not installed or SDK failed to init — app continues without tracing
    console.warn(`[tracing] Skipping OpenTelemetry (${err.message})`);
    return null;
  }
}

module.exports = { initTracing };
