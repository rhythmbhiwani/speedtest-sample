import axios from "axios";
import { useState } from "react";
import convert from "convert";
import { nanoid } from "nanoid";
import calculateJitter from "../helpers/calculateJitter";
import { ACTION } from "../helpers/ACTION";
import { SPEED_UNITS } from "../helpers/SPEED_UNITS";
import calculateAverageSpeed from "../helpers/calculateAverageSpeed";
import generateRandomFile from "../helpers/generateRandomFile";
import { STATUS } from "../helpers/STATUS";

interface Props {
  pingFrequency?: number;
  testDurationInSeconds?: number;
  speedUnit?: SPEED_UNITS;
}

const defaultProps = {
  pingFrequency: 10,
  testDurationInSeconds: 20,
  speedUnit: SPEED_UNITS.auto,
};

const useSpeedtest = ({
  pingFrequency = defaultProps.pingFrequency,
  testDurationInSeconds = defaultProps.testDurationInSeconds,
  speedUnit = defaultProps.speedUnit,
}: Props = defaultProps) => {
  const pingFrequencyValue = Math.min(Math.max(pingFrequency || 5, 5), 10);
  const testDurationInSecondsValue = Math.min(
    Math.max(testDurationInSeconds || 15, 15),
    60
  );

  const initialValues = {
    ping: {
      value: 0,
      unit: "ms",
    },
    jitter: {
      value: 0,
      unit: "ms",
    },
    uploadSpeed: {
      value: 0,
      unit: "Kbps",
    },
    downloadSpeed: {
      value: 0,
      unit: "Kbps",
    },
    pingStatus: STATUS.STALE,
    downloadStatus: STATUS.STALE,
    uploadStatus: STATUS.STALE,
    isRunning: false,
    isError: false,
    isCompleted: false,
  };
  const [speedtest, setSpeedTest] = useState(initialValues);

  const controller = {
    pings: new AbortController(),
    upload: new AbortController(),
    download: new AbortController(),
  };

  let downloadSpeedArray: number[] = [];
  let uploadSpeedArray: number[] = [];
  let pingArray: number[] = [];

  const instance = axios.create({
    baseURL: "https://speedtest.apyhi.com/",
  });

  instance.interceptors.request.use(
    (config) => {
      if (config.url?.startsWith("/download")) {
        setTimeout(() => {
          controller.download.abort();
        }, convert(testDurationInSecondsValue, "seconds").to("milliseconds"));
      } else if (config.url?.startsWith("/upload")) {
        setTimeout(() => {
          controller.upload.abort();
        }, convert(testDurationInSecondsValue, "seconds").to("milliseconds"));
      }

      (config as any).metadata = {
        startTime: new Date(),
      };
      return config;
    },
    function (error) {
      return Promise.reject(error);
    }
  );

  instance.interceptors.response.use(
    (response) => {
      const endTime = new Date() as any;
      response.headers.duration = (
        endTime - (response.config as any).metadata.startTime
      ).toString();
      return response;
    },
    function (error) {
      error.config.metadata.endTime = new Date();
      error.duration =
        error.config.metadata.endTime - error.config.metadata.startTime;
      return Promise.reject(error);
    }
  );

  const setSpeedWithUnits = (action: ACTION, value: number) => {
    const key = action === ACTION.DOWNLOAD ? "downloadSpeed" : "uploadSpeed";
    let unit = speedUnit;
    let speedValue = value;
    if (speedUnit === SPEED_UNITS.auto) {
      if (value >= convert(1, "megabit").to("bits")) {
        unit = SPEED_UNITS.Mbps;
        speedValue = convert(value, "bits").to("megabits");
      } else {
        unit = SPEED_UNITS.Kbps;
        speedValue = convert(value, "bits").to("kilobits");
      }
    } else {
      if (speedUnit === SPEED_UNITS.Mbps) {
        unit = SPEED_UNITS.Mbps;
        speedValue = convert(value, "bits").to("megabits");
      } else {
        unit = SPEED_UNITS.Kbps;
        speedValue = convert(value, "bits").to("kilobits");
      }
    }
    speedValue = parseFloat(speedValue.toFixed(2));
    setSpeedTest((prev) => ({
      ...prev,
      [key]: {
        value: speedValue,
        unit: unit,
      },
    }));
  };

  const startTest = async () => {
    // Check if already running
    if (speedtest.isRunning) {
      console.log("Please wait for previous test to complete.");
      return;
    }

    // Reset Local Variables
    downloadSpeedArray = [];
    uploadSpeedArray = [];
    pingArray = [];
    setSpeedTest({ ...initialValues, isRunning: true });

    try {
      // Test for ping
      setSpeedTest((prev) => ({ ...prev, pingStatus: STATUS.RUNNING }));

      for (let pingIndex = 0; pingIndex < pingFrequencyValue; pingIndex++) {
        await instance
          .get("/health", {
            signal: controller.pings.signal,
          })
          .then((res) =>
            pingArray.push(parseFloat(res.headers.duration || "0"))
          )
          .catch(() => {
            pingArray.push(0);
          });
      }

      // Calculate Ping and Jitter Results
      const filteredPings = pingArray.filter((ping) => ping !== 0).slice(1);
      if (filteredPings.length < 4) {
        throw new Error("Didn't got sufficient ping");
      }

      const jitter = calculateJitter(filteredPings);

      setSpeedTest((value) => ({
        ...value,
        jitter: {
          value: jitter,
          unit: "ms",
        },
        ping: {
          value: Math.min(...filteredPings),
          unit: "ms",
        },
      }));

      setSpeedTest((prev) => ({
        ...prev,
        pingStatus: STATUS.COMPLETED,
        downloadStatus: STATUS.RUNNING,
      }));

      // Test for Download
      await instance
        .get(`/download/1GiB`, {
          signal: controller.download.signal,
          onDownloadProgress: (progress) => {
            const rate = convert(progress.rate || 0, "bytes").to("bits");
            downloadSpeedArray.push(rate);
            setSpeedWithUnits(ACTION.DOWNLOAD, rate);
          },
        })
        .then(() => {
          const rate = calculateAverageSpeed(downloadSpeedArray);
          setSpeedWithUnits(ACTION.DOWNLOAD, rate);
        })
        .catch((err) => {
          if (err.code === "ERR_CANCELED") {
            const rate = calculateAverageSpeed(downloadSpeedArray);
            setSpeedWithUnits(ACTION.DOWNLOAD, rate);
          } else {
            throw err;
          }
        });

      setSpeedTest((prev) => ({
        ...prev,
        downloadStatus: STATUS.COMPLETED,
        uploadStatus: STATUS.RUNNING,
      }));

      // Test for Upload
      const form = new FormData();
      form.append(
        "uploadFile",
        generateRandomFile(convert(1, "GB").to("bytes"))
      );
      await instance
        .post("/upload", form, {
          signal: controller.upload.signal,
          onUploadProgress: (progress) => {
            const rate = convert(progress.rate || 0, "bytes").to("bits");
            uploadSpeedArray.push(rate);
            setSpeedWithUnits(ACTION.UPLOAD, rate);
          },
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .then(() => {
          const rate = calculateAverageSpeed(uploadSpeedArray);
          setSpeedWithUnits(ACTION.UPLOAD, rate);
        })
        .catch((err) => {
          if (err.code === "ERR_CANCELED") {
            const rate = calculateAverageSpeed(uploadSpeedArray);
            setSpeedWithUnits(ACTION.UPLOAD, rate);
          } else {
            throw err;
          }
        });

      setSpeedTest((value) => ({
        ...value,
        uploadStatus: STATUS.COMPLETED,
        isError: false,
        isRunning: false,
        isCompleted: true,
      }));
    } catch (e) {
      console.log(e);
      setSpeedTest((value) => ({
        ...value,
        isError: true,
        isRunning: false,
        isCompleted: true,
      }));
    }
  };

  return { ...speedtest, startTest };
};
export default useSpeedtest;
