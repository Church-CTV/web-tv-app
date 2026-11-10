/**
 * WEBOS production bundle: telemetry obeys the delivered channel
 * profile - the endpoint it names and the envelope that endpoint takes.
 * Assertions live in `analytics-envelope.helper.ts` so all three platforms are
 * held to the same contract.
 */

import { defineAnalyticsEnvelopeTests } from './analytics-envelope.helper';

defineAnalyticsEnvelopeTests();
