const { createMockApiClient } = require("./mock-api-client");
const { API_BASE_URL } = require("../config/api");
const { createBackendApiClient } = require("./backend-api-client");

let devApiClient = null;

function getDevApiClient() {
  if (!devApiClient) {
    devApiClient = API_BASE_URL
      ? createBackendApiClient({ baseUrl: API_BASE_URL })
      : createMockApiClient();
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
