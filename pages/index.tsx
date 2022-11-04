import { SPEED_UNITS } from "../lib/helpers/SPEED_UNITS";
import useSpeedtest from "../lib/hooks/useSpeedtest";

export default function Home() {
  const {
    downloadSpeed,
    isCompleted,
    isError,
    ping,
    startTest,
    uploadSpeed,
    isRunning,
    jitter,
    downloadStatus,
    pingStatus,
    uploadStatus,
  } = useSpeedtest({
    speedUnit: SPEED_UNITS.auto,
  });

  return (
    <div>
      <button onClick={startTest}>Test Now</button>

      <p>
        Ping: {ping.value} {ping.unit}
      </p>
      <p>
        jitter: {jitter.value} {jitter.unit}
      </p>
      <p>
        Download: {downloadSpeed.value} {downloadSpeed.unit}
      </p>
      <p>
        Upload: {uploadSpeed.value} {uploadSpeed.unit}
      </p>

      <p>pingStatus: {pingStatus}</p>
      <p>downloadStatus: {downloadStatus}</p>
      <p>uploadStatus: {uploadStatus}</p>
      <p>isCompleted: {isCompleted ? "True" : "False"}</p>
      <p>isError: {isError ? "True" : "False"}</p>
      <p>isRunning: {isRunning ? "True" : "False"}</p>
    </div>
  );
}
