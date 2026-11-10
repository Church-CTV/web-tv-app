/**
 * Heartbeat contract.
 * Shared between all CTV platforms for periodic health checkins with the
 * server. Reports device presence and minimal operational state.
 */

export interface HeartbeatPayload {
  deviceId: string;
  channelName: string;
  appVersion: string;
  os: string;
  build: string;
  model: string;
  locale: string;
}

export interface HeartbeatResponse {
  ok: boolean;
  serverTime: string;
}
