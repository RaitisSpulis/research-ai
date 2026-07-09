const { sendError, sendOk } = require("./_responses");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendError(response, 400, "method_not_allowed", "Use GET to read public configuration.");
    return;
  }

  sendOk(response, {
    clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || ""
  });
};
