const calculateJitter = (pings: number[]) => {
  const delta = pings
    .reduce(function (previousValue, currentValue, currentIndex, array) {
      currentIndex &&
        previousValue.push(Math.abs(currentValue - array[currentIndex - 1]));
      return previousValue;
    }, [] as number[])
    .filter((d) => d !== 0);

  const average =
    delta.reduce(function (a, b) {
      return a + b;
    }) / delta.length;

  return Math.round((average + Number.EPSILON) * 100) / 100;
};

export default calculateJitter;
