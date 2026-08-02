const { createMockApiClient } = require("./mock-api-client");

let devApiClient = null;

function getDevApiClient() {
  if (!devApiClient) {
    devApiClient = createMockApiClient();
  }
  return devApiClient;
}

function resetDevApiClient() {
  devApiClient = createMockApiClient();
  return devApiClient;
}

module.exports = {
  getDevApiClient,
  resetDevApiClient,
};
