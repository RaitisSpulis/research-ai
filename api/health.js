const { sendOk } = require("./_responses");

module.exports = function handler(request, response) {
  sendOk(response, {
    status: "ok",
    service: "ResearchAI API",
    mode: "demo"
  });
};
