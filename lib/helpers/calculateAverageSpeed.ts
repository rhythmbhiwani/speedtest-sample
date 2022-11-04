const calculateAverageSpeed = (speedArray: number[]) => {
  const originalLength = speedArray.length;
  const percent22 = Math.ceil((originalLength * 22) / 100);

  const filteredSpeed = speedArray.slice(percent22);

  return parseFloat(
    (filteredSpeed.reduce((a, b) => a + b, 0) / filteredSpeed.length).toFixed(2)
  );
};

export default calculateAverageSpeed;
