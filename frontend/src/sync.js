export function computeClockOffset(clientSentAt, clientReceivedAt, serverNow) {
  const rtt = clientReceivedAt - clientSentAt;
  const estimatedServerAtReceive = serverNow + rtt / 2;
  return estimatedServerAtReceive - clientReceivedAt;
}

export function serverToAudioTime({
  scheduledAt,
  nowClientMs,
  offsetMs,
  audioNowSec,
  minLeadSec = 0.04,
}) {
  const localScheduledMs = scheduledAt - offsetMs;
  const deltaMs = localScheduledMs - nowClientMs;
  return audioNowSec + Math.max(deltaMs / 1000, minLeadSec);
}
