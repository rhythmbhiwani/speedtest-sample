const generateRandomFile = (size: number) => {
  return new Blob([new ArrayBuffer(size)], {
    type: "application/octet-stream",
  });
};

export default generateRandomFile;
